// ============================================================================
// TECNIFLOW - NETLIFY SERVERLESS FUNCTION HANDLER (/api/*)
// ============================================================================
// Regras e Diretrizes Arquiteturais:
// 1. Isolamento Serverless Estrito: ZERO importação de SQLite, db.ts, Vite ou
//    listener HTTP local. Evita overhead de inicialização e dependências nativas.
// 2. Autenticação Bearer: Token JWT do Supabase Auth verificado por requisição
//    via auth.getUser(token).
// 3. Multi-tenancy & Isolamento: Vínculo de empresa verificado via RPC tf_get_company().
// 4. Cotas Atômicas: tf_get_help_ai_quota_status() e tf_reserve_help_ai_quota()
//    sob trava transacional serializada.
// 5. Fail-Closed: Qualquer rota legada sob /api/* é rejeitada com HTTP 410 (CLOUD_OPERATIONS_ONLY).
// 6. Segurança e Observabilidade: Header X-Request-Id, Cache-Control: no-store,
//    e zero vazamento de segredos, dados de clientes ou stack traces.
// ============================================================================

import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateHelpResponse, isHelpAiEnabled, ChatMessage } from '../../server/services/helpAiService.js';

// Cache em memória de readiness probe (TTL 5s) para mitigar thundering herd no Supabase
interface ReadinessCache {
  ready: boolean;
  timestamp: number;
  latencyMs: number;
}

let lastReadinessCheck: ReadinessCache | null = null;
let pendingReadiness: Promise<ReadinessCache> | null = null;
const READINESS_CACHE_TTL_MS = 5000;

function createPerRequestSupabaseClient(token: string): SupabaseClient | null {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://aburknnkixeeqpvsyofc.supabase.co';
  const supabaseAnonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_nQu4lm4w3_Zq6a-18FvlsQ_johbNzzx';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  } catch {
    return null;
  }
}

function getSupabaseProbeClient(): SupabaseClient | null {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://aburknnkixeeqpvsyofc.supabase.co';
  const supabaseAnonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'sb_publishable_nQu4lm4w3_Zq6a-18FvlsQ_johbNzzx';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

function getCallerToken(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
    return null;
  }
  return parts[1].trim();
}

function jsonResponse(
  statusCode: number,
  body: Record<string, any>,
  requestId: string,
  extraHeaders: Record<string, string> = {}
): HandlerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function extractApiPath(rawPath: string): string {
  // Normalize path removing /.netlify/functions/api or /api prefix
  let clean = rawPath
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  return clean.toLowerCase().replace(/\/+/g, '/');
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext): Promise<HandlerResponse> => {
  const requestId = crypto.randomUUID();
  const method = (event.httpMethod || 'GET').toUpperCase();
  const normalizedPath = extractApiPath(event.path || '/');

  // Handle CORS preflight if called cross-origin
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Request-Id',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
      body: '',
    };
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/health (Liveness)
  // --------------------------------------------------------------------------
  if (normalizedPath === '/health' && method === 'GET') {
    return jsonResponse(
      200,
      {
        status: 'ok',
        app: 'TecniFlow',
        provider: 'supabase-cloud',
        timestamp: new Date().toISOString(),
        requestId,
      },
      requestId
    );
  }

  // --------------------------------------------------------------------------
  // 2. GET /api/health/ready (Readiness - Supabase Catalog/RPC Probe)
  // --------------------------------------------------------------------------
  if (normalizedPath === '/health/ready' && method === 'GET') {
    if (!lastReadinessCheck || Date.now() - lastReadinessCheck.timestamp >= READINESS_CACHE_TTL_MS) {
      if (!pendingReadiness) {
        pendingReadiness = (async (): Promise<ReadinessCache> => {
          const started = Date.now();
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          try {
            const probeClient = getSupabaseProbeClient();
            if (!probeClient) {
              return { ready: false, timestamp: Date.now(), latencyMs: Date.now() - started };
            }
            const { data, error } = await probeClient
              .rpc('tf_health_probe')
              .abortSignal(controller.signal);
            return {
              ready: !error && data?.ready === true && data?.status === 'ok',
              timestamp: Date.now(),
              latencyMs: Date.now() - started,
            };
          } catch {
            return { ready: false, timestamp: Date.now(), latencyMs: Date.now() - started };
          } finally {
            clearTimeout(timer);
          }
        })();
      }
      lastReadinessCheck = await pendingReadiness;
      pendingReadiness = null;
    }

    const result = lastReadinessCheck;
    return jsonResponse(
      result.ready ? 200 : 503,
      {
        status: result.ready ? 'ready' : 'unavailable',
        latencyMs: result.latencyMs,
        timestamp: new Date().toISOString(),
        requestId,
      },
      requestId
    );
  }

  // --------------------------------------------------------------------------
  // 3. GET /api/help/quota (Consulta de Cota do Assistente de IA)
  // --------------------------------------------------------------------------
  if (normalizedPath === '/help/quota' && method === 'GET') {
    const token = getCallerToken(event.headers);
    if (!token) {
      return jsonResponse(401, { error: 'Não autenticado.' }, requestId);
    }

    const supabase = createPerRequestSupabaseClient(token);
    if (!supabase) {
      return jsonResponse(503, { error: 'Infraestrutura indisponível no momento.' }, requestId);
    }

    try {
      // 1. Validar identidade via Supabase Auth
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        if (userError && ((userError.status || 0) >= 500 || userError.name?.includes('Fetch'))) {
          return jsonResponse(503, { error: 'Não foi possível verificar a sessão agora.' }, requestId);
        }
        return jsonResponse(401, { error: 'Token inválido ou expirado.' }, requestId);
      }

      // 2. Validar vínculo com a empresa via RPC tf_get_company()
      const { data: compData, error: compError } = await supabase.rpc('tf_get_company');
      if (compError || !compData?.company?.id) {
        if (compError && compError.code !== '42501' && !compError.message?.includes('Acesso não autorizado')) {
          return jsonResponse(503, { error: 'Não foi possível verificar o vínculo agora.' }, requestId);
        }
        return jsonResponse(403, { error: 'Vínculo com empresa não encontrado.' }, requestId);
      }

      // 3. Consultar status de cota da empresa via RPC tf_get_help_ai_quota_status()
      const { data: quotaStatus, error: quotaError } = await supabase.rpc('tf_get_help_ai_quota_status');
      if (quotaError || !quotaStatus || typeof quotaStatus.remaining !== 'number') {
        console.error('[Help Quota Serverless Error]', 'QUOTA_STATUS_FAILED');
        return jsonResponse(503, { error: 'Falha ao consultar limites de atendimento.' }, requestId);
      }

      return jsonResponse(
        200,
        {
          quota: {
            used: quotaStatus?.used ?? 0,
            limit: quotaStatus?.limit ?? 10,
            remaining: quotaStatus?.remaining ?? 10,
            allowed: quotaStatus?.allowed ?? true,
          },
          aiAvailable: isHelpAiEnabled(),
        },
        requestId
      );
    } catch {
      console.error('[Help Quota Serverless Error]', 'INTERNAL_ERROR');
      return jsonResponse(503, { error: 'Falha ao processar consulta de cota.' }, requestId);
    }
  }

  // --------------------------------------------------------------------------
  // 4. POST /api/help/chat (Atendimento via IA com Cota Trava Serializada)
  // --------------------------------------------------------------------------
  if (normalizedPath === '/help/chat' && method === 'POST') {
    const rawBodyText = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '';

    // 1. Limite estrito de tamanho UTF-8 (16KB)
    const bodyBytes = Buffer.byteLength(rawBodyText, 'utf8');
    if (bodyBytes > 16384) {
      return jsonResponse(
        400,
        { error: 'Tamanho da mensagem excede o limite permitido (16KB).' },
        requestId
      );
    }

    // 2. Parsing e validação de objeto JSON
    let parsedBody: any;
    try {
      parsedBody = JSON.parse(rawBodyText);
    } catch {
      return jsonResponse(400, { error: 'Corpo da requisição inválido.' }, requestId);
    }

    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return jsonResponse(400, { error: 'Corpo da requisição inválido.' }, requestId);
    }

    // 3. Rejeitar chaves extras no nível superior
    const topKeys = Object.keys(parsedBody);
    const hasExtraTopKeys = topKeys.some((k) => k !== 'message' && k !== 'history');
    if (hasExtraTopKeys) {
      return jsonResponse(400, { error: 'Parâmetros não permitidos no corpo da requisição.' }, requestId);
    }

    // 4. Validação do campo message
    if (typeof parsedBody.message !== 'string') {
      return jsonResponse(400, { error: 'Mensagem inválida.' }, requestId);
    }
    const trimmedMessage = parsedBody.message.trim();
    if (!trimmedMessage || trimmedMessage.length > 1500) {
      return jsonResponse(400, { error: 'A mensagem deve conter entre 1 e 1500 caracteres.' }, requestId);
    }

    // 5. Validação estrita do campo history
    const history: ChatMessage[] = [];
    if (parsedBody.history !== undefined) {
      if (!Array.isArray(parsedBody.history)) {
        return jsonResponse(400, { error: 'O histórico deve ser uma lista.' }, requestId);
      }

      if (parsedBody.history.length > 6) {
        return jsonResponse(400, { error: 'O histórico excede o limite permitido de turnos.' }, requestId);
      }

      if (parsedBody.history.length > 0) {
        // Regra 1: Primeiro item DEVE ser do usuário
        if (parsedBody.history[0]?.role !== 'user') {
          return jsonResponse(400, { error: 'O histórico deve iniciar com mensagem do usuário.' }, requestId);
        }

        for (let i = 0; i < parsedBody.history.length; i++) {
          const item = parsedBody.history[i];
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return jsonResponse(400, { error: 'Item do histórico inválido.' }, requestId);
          }

          const itemKeys = Object.keys(item);
          if (itemKeys.some((k) => k !== 'role' && k !== 'content')) {
            return jsonResponse(400, { error: 'Item do histórico contém parâmetros não permitidos.' }, requestId);
          }

          if (item.role !== 'user' && item.role !== 'model') {
            return jsonResponse(400, { error: 'Papel de mensagem inválido no histórico.' }, requestId);
          }

          if (typeof item.content !== 'string' || !item.content.trim() || item.content.length > 1000) {
            return jsonResponse(400, { error: 'Conteúdo de mensagem inválido no histórico.' }, requestId);
          }

          // Regra 2: Alternância obrigatória
          if (i > 0 && item.role === parsedBody.history[i - 1].role) {
            return jsonResponse(400, { error: 'O histórico deve alternar estritamente entre usuário e modelo.' }, requestId);
          }

          history.push({
            role: item.role,
            content: item.content.trim(),
          });
        }

        // Regra 3: Último item deve ser do modelo
        if (history[history.length - 1].role !== 'model') {
          return jsonResponse(
            400,
            { error: 'O histórico deve terminar com resposta do modelo antes da pergunta atual.' },
            requestId
          );
        }
      }
    }

    // 6. Autenticação por token Bearer
    const token = getCallerToken(event.headers);
    if (!token) {
      return jsonResponse(401, { error: 'Não autenticado.' }, requestId);
    }

    const supabase = createPerRequestSupabaseClient(token);
    if (!supabase) {
      return jsonResponse(503, { error: 'Infraestrutura indisponível no momento.' }, requestId);
    }

    try {
      // 7. Validar identidade no Supabase Auth
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        if (userError && ((userError.status || 0) >= 500 || userError.name?.includes('Fetch'))) {
          return jsonResponse(503, { error: 'Não foi possível verificar a sessão agora.' }, requestId);
        }
        return jsonResponse(401, { error: 'Token inválido ou expirado.' }, requestId);
      }

      // 8. Validar vínculo com empresa via RPC tf_get_company()
      const { data: compData, error: compError } = await supabase.rpc('tf_get_company');
      if (compError || !compData?.company?.id) {
        if (compError && compError.code !== '42501' && !compError.message?.includes('Acesso não autorizado')) {
          return jsonResponse(503, { error: 'Não foi possível verificar o vínculo agora.' }, requestId);
        }
        return jsonResponse(403, { error: 'Vínculo com empresa não encontrado.' }, requestId);
      }

      if (!isHelpAiEnabled()) {
        return jsonResponse(
          503,
          { error: 'O assistente está temporariamente indisponível. Consulte as Perguntas Frequentes.' },
          requestId
        );
      }

      // 9. Reservar cota no banco via RPC tf_reserve_help_ai_quota() sob trava serializada
      const { data: quotaRes, error: quotaErr } = await supabase.rpc('tf_reserve_help_ai_quota');
      if (quotaErr || !quotaRes || typeof quotaRes.allowed !== 'boolean') {
        console.error('[Help Chat Serverless Error]', 'QUOTA_RESERVATION_FAILED');
        return jsonResponse(503, { error: 'Falha ao validar limite de atendimento no momento.' }, requestId);
      }

      if (!quotaRes?.allowed) {
        if (quotaRes?.reason === 'quota_exceeded') {
          return jsonResponse(
            429,
            {
              error:
                'Limite diário de 10 consultas do assistente atingido. O limite renova à meia-noite, no horário de Brasília.',
              quota: quotaRes,
            },
            requestId
          );
        }
        if (quotaRes?.reason === 'rate_limit') {
          return jsonResponse(
            429,
            {
              error: 'Muitas mensagens em pouco tempo. Aguarde um instante antes de enviar nova pergunta.',
              quota: quotaRes,
            },
            requestId
          );
        }
        return jsonResponse(
          429,
          {
            error: 'Limite de consultas do assistente atingido no momento.',
            quota: quotaRes,
          },
          requestId
        );
      }

      // 10. Chamar o modelo Gemini
      try {
        const aiResponse = await generateHelpResponse(trimmedMessage, history);

        return jsonResponse(
          200,
          {
            reply: aiResponse.reply,
            quota: {
              used: quotaRes.used,
              limit: quotaRes.limit,
              remaining: quotaRes.remaining,
            },
          },
          requestId
        );
      } catch (aiErr: any) {
        const errCode = aiErr?.message || '';
        if (errCode === 'AI_TIMEOUT') {
          return jsonResponse(
            504,
            { error: 'O assistente demorou para responder. Tente novamente com uma pergunta mais direta.' },
            requestId
          );
        }
        if (errCode === 'AI_RATE_LIMIT') {
          return jsonResponse(
            429,
            { error: 'O assistente está com alta demanda no momento. Aguarde alguns instantes.' },
            requestId
          );
        }
        return jsonResponse(
          503,
          { error: 'O assistente está temporariamente indisponível. Consulte o FAQ e os artigos da Central de Ajuda.' },
          requestId
        );
      }
    } catch {
      console.error('[Help Chat Serverless Error]', 'INTERNAL_ERROR');
      return jsonResponse(503, { error: 'Falha ao processar atendimento no momento.' }, requestId);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Fail-Closed Default: Bloquear qualquer outra rota de API legada com HTTP 410
  // --------------------------------------------------------------------------
  console.warn('[Netlify Function] Legacy route blocked', {
    requestId,
    code: 'LEGACY_ROUTE_BLOCKED',
  });

  return jsonResponse(
    410,
    {
      error: 'Esta operação não está disponível. Atualize o aplicativo e tente novamente.',
      code: 'CLOUD_OPERATIONS_ONLY',
      requestId,
    },
    requestId
  );
};
