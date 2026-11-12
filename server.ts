import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './server/routes/authRoutes.js';
import { clientRouter } from './server/routes/clientRoutes.js';
import { inventoryRouter } from './server/routes/inventoryRoutes.js';
import { orderRouter } from './server/routes/orderRoutes.js';
import { reportRouter } from './server/routes/reportRoutes.js';
import { companyRouter } from './server/routes/companyRoutes.js';
import { billingRouter } from './server/routes/billingRoutes.js';
import { helpRouter } from './server/routes/helpRoutes.js';
import { mainDb, DatabaseAdapter } from './server/db.js';

import http from 'node:http';
import crypto from 'node:crypto';
import { logger } from './server/lib/logger.js';
import { dispatchCriticalAlert } from './server/services/alertService.js';
import { getSupabaseAuthClient } from './server/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory readiness probe cache (5 seconds TTL) to prevent hammering Supabase
interface ReadinessCache {
  ready: boolean;
  timestamp: number;
  latencyMs: number;
  error?: string;
}

const READINESS_CACHE_TTL_MS = 5000;

export function createApp(dbInstance: DatabaseAdapter = mainDb, options: {allowLegacyTestRoutes?: boolean} = {}): Express {
  const app = express();
  let lastReadinessCheck: ReadinessCache | null = null;
  let pendingReadiness: Promise<ReadinessCache> | null = null;
  const legacyTestMode = process.env.NODE_ENV === 'test' && options.allowLegacyTestRoutes === true;

  // Trust Cloud Run / Google Cloud front-end proxy for secure cookies & protocol
  app.set('trust proxy', 1);

  // Attach Request-ID to all requests for correlation and traceability
  app.use((req: any, res, next) => {
    const reqId = crypto.randomUUID();
    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
  });

  app.use(express.json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf.toString('utf8');
    }
  }));
  // Handle invalid/malformed JSON bodies gracefully with HTTP 400 without crashing
  app.use((err: any, req: any, res: any, next: any) => {
    if (err) {
      logger.warn('Corpo da requisição JSON inválido', {
        requestId: req.id,
        path: req.path,
        method: req.method,
        code: 'INVALID_JSON_BODY',
      });
      res.status(400).json({ error: 'Corpo da requisição inválido.' });
      return;
    }
    next();
  });
  app.use(cookieParser());

  // Attach database instance to requests
  app.use((req: any, _res, next) => {
    req.db = dbInstance;
    next();
  });

  // Production defaults to cloud only; HTTP callers cannot enable the legacy adapter.
  app.use('/api', (req: any, res, next) => {
    if (legacyTestMode) { next(); return; }
    let route: string;
    try { route = decodeURIComponent(req.path).toLowerCase().replace(/\/+/g, '/'); }
    catch { res.status(400).json({error:'Endereço inválido.',requestId:req.id}); return; }
    const allowed = ['/health','/health/ready','/help/chat','/help/quota','/auth/export-legacy'];
    if (!allowed.includes(route)) {
      logger.warn('Legacy route blocked',{requestId:req.id,method:req.method,code:'LEGACY_ROUTE_BLOCKED'});
      res.status(410).json({error:'Esta operação não está disponível. Atualize o aplicativo e tente novamente.',code:'CLOUD_OPERATIONS_ONLY',requestId:req.id});
      return;
    }
    next();
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/clients', clientRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/reports', reportRouter);
  app.use('/api/company', companyRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/help', helpRouter);

  // Health check: Liveness (indicates Node process is responsive)
  app.get('/api/health', (req: any, res) => {
    res.json({
      status: 'ok',
      app: 'TecniFlow',
      provider: dbInstance.provider,
      timestamp: new Date().toISOString(),
      requestId: req.id,
    });
  });

  // Only the real Supabase catalog/RPC probe can make readiness healthy.
  app.get('/api/health/ready', async (req: any, res) => {
    res.setHeader('Cache-Control','no-store');
    if (!lastReadinessCheck || Date.now()-lastReadinessCheck.timestamp>=READINESS_CACHE_TTL_MS) {
      if (!pendingReadiness) {
        pendingReadiness = (async (): Promise<ReadinessCache> => {
          const started=Date.now(), controller=new AbortController();
          const timer=setTimeout(()=>controller.abort(),3000);
          try {
            const {data,error}=await getSupabaseAuthClient().rpc('tf_health_probe').abortSignal(controller.signal);
            return {ready:!error&&data?.ready===true&&data?.status==='ok',timestamp:Date.now(),latencyMs:Date.now()-started};
          } catch { return {ready:false,timestamp:Date.now(),latencyMs:Date.now()-started}; }
          finally { clearTimeout(timer); }
        })();
      }
      lastReadinessCheck=await pendingReadiness;
      pendingReadiness=null;
      if (!lastReadinessCheck.ready) {
        logger.warn('Dependency unavailable',{requestId:req.id,code:'SUPABASE_READINESS_FAILED'});
        void dispatchCriticalAlert({area:'system',code:'SUPABASE_READINESS_FAILED',severity:'error',correlationId:req.id,timestamp:new Date().toISOString()});
      }
    }
    const result=lastReadinessCheck;
    res.status(result.ready?200:503).json({status:result.ready?'ready':'unavailable',latencyMs:result.latencyMs,timestamp:new Date().toISOString(),requestId:req.id});
  });

  // Global error handler for /api routes: catches all async rejections forwarded by asyncHandler
  // Returns safe generic JSON response without crashing Express or leaking stack traces/credentials
  app.use('/api', (err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const reqId = (req as any).id;
    const statusCode = (typeof err?.status === 'number' && err.status >= 400 && err.status < 600)
      ? err.status
      : 500;

    if (statusCode>=500) void dispatchCriticalAlert({area:'system',code:'INTERNAL_ERROR',severity:'error',correlationId:reqId,timestamp:new Date().toISOString()});
    logger.error('Erro na camada de API', {
      requestId: reqId,
      path: req.path,
      method: req.method,
      status: statusCode,
      code: err?.code || 'INTERNAL_ERROR',
    });

    if (res.headersSent) {
      return;
    }

    res.status(statusCode).json({
      error: 'Erro interno no servidor ao processar a requisição.',
      requestId: reqId,
    });
  });

  return app;
}

async function startServer() {
  // If PostgreSQL is selected, strictly validate connection and schema before accepting requests
  if (mainDb.provider === 'postgres' && typeof (mainDb as any).testConnection === 'function') {
    const check = await (mainDb as any).testConnection();
    console.log(`[TecniFlow] Conexão com PostgreSQL/Supabase validada (${check.tableCount} tabelas no schema tecniflow).`);
  }

  const app = createApp(mainDb);
  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`[TecniFlow] Servidor rodando em http://0.0.0.0:${port} [Banco: ${mainDb.provider}]`);
  });
}

// Only auto-start when run directly, not when imported in test runner
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer().catch((err) => {
    logger.error('Server startup failed',{code:'SERVER_START_FAILED'});
    process.exit(1);
  });
}
