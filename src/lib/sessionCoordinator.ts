/**
 * TecniFlow - Session Coordinator & Safe Redirects
 *
 * Provides:
 * 1. Safe, validated callback URLs for confirmation and password recovery.
 * 2. Concurrency-safe, generation-tracked session synchronization that eliminates
 *    race conditions between onAuthStateChange, manual login, and logout.
 */

export function getSafeRedirectUrl(targetPath: string, envOverride?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const cleanPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  const defaultUrl = `${window.location.origin}${cleanPath}`;

  if (envOverride && typeof envOverride === 'string' && envOverride.trim()) {
    try {
      const trimmed = envOverride.trim();
      // Must be a valid absolute HTTP or HTTPS URL
      if (!/^https?:\/\//i.test(trimmed)) {
        console.warn('[TecniFlow Auth] Override de URL de redirecionamento rejeitado (deve ser HTTP/HTTPS):', envOverride);
        return defaultUrl;
      }
      const parsed = new URL(trimmed);
      return parsed.toString();
    } catch {
      console.warn('[TecniFlow Auth] Override de URL de redirecionamento inválido:', envOverride);
    }
  }

  return defaultUrl;
}

export function isIframeOrPreview(win = typeof window !== 'undefined' ? window : undefined): boolean {
  if (!win || !win.location) return false;
  try {
    if (win.self !== win.top) return true;
  } catch {
    return true; // blocked by cross-origin iframe security
  }
  const hostname = win.location.hostname || '';
  if (
    hostname.includes('.run.app') ||
    hostname.includes('webcontainer') ||
    hostname.includes('aistudio') ||
    hostname.includes('ai.studio') ||
    hostname.includes('googleusercontent.com')
  ) {
    return true;
  }
  return false;
}

function isDevEnvironment(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') return true;
  return false;
}

export function validateRedirectOverride(urlStr: string): { valid: boolean; normalized?: string; reason?: string } {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
    return { valid: false, reason: 'URL vazia' };
  }
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.username || parsed.password) {
      return { valid: false, reason: 'URL não pode conter credenciais de usuário' };
    }
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocal) {
      if (!isDevEnvironment()) {
        return { valid: false, reason: 'Redirecionamento local permitido exclusivamente em ambiente de desenvolvimento' };
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, reason: 'URL local deve utilizar HTTP ou HTTPS' };
      }
    } else {
      if (parsed.protocol !== 'https:') {
        return { valid: false, reason: 'URL de produção deve utilizar o protocolo seguro HTTPS' };
      }
    }
    return { valid: true, normalized: parsed.toString() };
  } catch {
    return { valid: false, reason: 'Formato de URL inválido' };
  }
}

export function resolveRecoveryRedirectUrl(
  envOverride?: string,
  win = typeof window !== 'undefined' ? window : undefined
): string {
  if (envOverride && typeof envOverride === 'string' && envOverride.trim()) {
    const validation = validateRedirectOverride(envOverride.trim());
    if (validation.valid && validation.normalized) {
      return validation.normalized;
    }
    console.warn('[TecniFlow Auth] Override de URL de recuperação rejeitado (motivo):', validation.reason);
  }

  if (isIframeOrPreview(win)) {
    throw new Error('Não foi possível enviar o link agora. Tente novamente mais tarde.');
  }

  if (!win || !win.location || !win.location.origin) {
    throw new Error('Origem de redirecionamento não configurada para recuperação de senha.');
  }

  try {
    const parsedOrigin = new URL(win.location.origin);
    const isLocal = parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1';
    if (isLocal) {
      if (!isDevEnvironment()) {
        throw new Error('Origem de desenvolvimento local não autorizada em ambiente de produção.');
      }
    } else if (parsedOrigin.protocol !== 'https:') {
      throw new Error('Origem de redirecionamento em produção deve utilizar HTTPS.');
    }
    return `${parsedOrigin.origin}/?auth=recovery`;
  } catch (err: any) {
    if (err instanceof Error && (err.message.includes('Não foi possível enviar o link agora') || err.message.includes('HTTPS') || err.message.includes('produção') || err.message.includes('recuperação'))) {
      throw err;
    }
    throw new Error('Origem de redirecionamento inválida para recuperação de senha.');
  }
}

export function isRecoveryUrl(locationLike?: { search?: string; hash?: string }): boolean {
  const loc = locationLike || (typeof window !== 'undefined' ? window.location : undefined);
  if (!loc) return false;

  try {
    const rawSearch = (loc.search || '').replace(/^\?/, '');
    const searchParams = new URLSearchParams(rawSearch);
    if (searchParams.get('auth') === 'recovery') return true;

    const rawHash = (loc.hash || '').replace(/^#/, '');
    if (rawHash === 'reset-password' || rawHash.startsWith('reset-password&') || rawHash.startsWith('reset-password?')) {
      return true;
    }

    const queryIndex = rawHash.indexOf('?');
    const hashQuery = queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : rawHash;
    const hashParams = new URLSearchParams(hashQuery);

    if (hashParams.get('type') === 'recovery') return true;
    if (hashParams.get('auth') === 'recovery') return true;
    if (hashParams.has('reset-password')) return true;
  } catch {}

  return false;
}

export function isUrlExpiredOrError(locationLike?: { search?: string; hash?: string }): {
  isError: boolean;
  code?: string;
  description?: string;
} {
  const loc = locationLike || (typeof window !== 'undefined' ? window.location : undefined);
  if (!loc) return { isError: false };

  try {
    const rawHash = (loc.hash || '').replace(/^#/, '');
    const rawSearch = (loc.search || '').replace(/^\?/, '');

    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);

    const error = hashParams.get('error') || searchParams.get('error');
    const errorCode = hashParams.get('error_code') || searchParams.get('error_code');
    const rawDesc = hashParams.get('error_description') || searchParams.get('error_description');

    if (error || errorCode) {
      return {
        isError: true,
        code: errorCode || error || undefined,
        description: rawDesc ? rawDesc.replace(/\+/g, ' ') : undefined,
      };
    }
  } catch {}

  return { isError: false };
}

export function cleanAuthUrl(win = typeof window !== 'undefined' ? window : undefined): void {
  if (!win || !win.history || !win.location) return;
  try {
    const cleanPath = win.location.pathname || '/';
    win.history.replaceState({}, (win.document && win.document.title) || 'TecniFlow', cleanPath);
  } catch (e) {
    console.warn('[TecniFlow Auth] Falha ao limpar URL temporária:', e);
  }
}

export interface SessionSyncResult<T> {
  cancelled: boolean;
  data?: T;
  error?: Error;
}

export class SessionCoordinator<T = { user: any; company: any; csrfToken?: string }> {
  private generation = 0;
  private activeToken: string | null = null;
  private activeUserId: string | null = null;
  private inFlightSync: {
    promise: Promise<SessionSyncResult<T>>;
    token: string;
    userId: string;
    generation: number;
  } | null = null;

  public getGeneration(): number {
    return this.generation;
  }

  public getActiveToken(): string | null {
    return this.activeToken;
  }

  public getActiveUserId(): string | null {
    return this.activeUserId;
  }

  /**
   * Invalidates any ongoing or pending session synchronization requests.
   * Advances the generation counter and clears active tokens.
   */
  public invalidate(): number {
    this.generation++;
    this.activeToken = null;
    this.activeUserId = null;
    this.inFlightSync = null;
    return this.generation;
  }

  /**
   * Synchronizes session state with the backend.
   * If an identical request for the same token and user is already in flight, reuses it.
   * If a previous or slower request finishes after a new session or logout occurred,
   * its result is automatically cancelled/discarded.
   */
  public sync(
    token: string,
    userId: string,
    fetcher: (token: string) => Promise<T>
  ): Promise<SessionSyncResult<T>> {
    // Deduplicate in-flight requests for identical token and user within the current generation
    if (
      this.inFlightSync &&
      this.inFlightSync.token === token &&
      this.inFlightSync.userId === userId &&
      this.inFlightSync.generation === this.generation
    ) {
      return this.inFlightSync.promise;
    }

    this.generation++;
    const currentGen = this.generation;
    this.activeToken = token;
    this.activeUserId = userId;

    const promise = (async (): Promise<SessionSyncResult<T>> => {
      try {
        const data = await fetcher(token);
        // Verify this result still belongs to the active generation and user
        if (
          this.generation !== currentGen ||
          this.activeToken !== token ||
          this.activeUserId !== userId
        ) {
          return { cancelled: true };
        }
        this.inFlightSync = null;
        return { cancelled: false, data };
      } catch (err: any) {
        if (
          this.generation !== currentGen ||
          this.activeToken !== token ||
          this.activeUserId !== userId
        ) {
          return { cancelled: true };
        }
        this.inFlightSync = null;
        return {
          cancelled: false,
          error: err instanceof Error ? err : new Error(String(err?.message || err || 'Erro de sincronização')),
        };
      }
    })();

    this.inFlightSync = {
      promise,
      token,
      userId,
      generation: currentGen,
    };

    return promise;
  }
}
