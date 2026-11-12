import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User, Company, BillingStatus } from '../types';
import { apiRequest, setApiAccessToken } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  SessionCoordinator,
  getSafeRedirectUrl,
  resolveRecoveryRedirectUrl,
  isRecoveryUrl,
  isUrlExpiredOrError,
  cleanAuthUrl,
} from '../lib/sessionCoordinator';

interface RegisterData {
  companyName: string;
  companyDocument?: string;
  companyPhone?: string;
  companyWhatsapp?: string;
  companyAddress?: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  billing: BillingStatus | null;
  loading: boolean;
  error: string | null;
  isRecoveryMode: boolean;
  recoveryState: 'idle' | 'verifying' | 'ready' | 'expired_or_invalid' | 'password_updated_signout_pending';
  confirmationPendingEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<{ confirmationRequired: boolean }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateCompany: (data: Partial<Company>) => Promise<void>;
  updateCompanyLogo: (logoDataUrl: string | null) => Promise<void>;
  refreshAuth: () => Promise<void>;
  refreshBilling: () => Promise<BillingStatus | null>;
  clearConfirmationPending: () => void;
  exitRecoveryMode: () => Promise<{ success: boolean; error?: Error }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [recoveryState, setRecoveryState] = useState<'idle' | 'verifying' | 'ready' | 'expired_or_invalid' | 'password_updated_signout_pending'>('idle');
  const [confirmationPendingEmail, setConfirmationPendingEmail] = useState<string | null>(null);

  // Stable refs to prevent effect re-subscriptions, stale responses and race conditions
  const isRecoveryModeRef = React.useRef<boolean>(false);
  const recoveryStateRef = React.useRef<'idle' | 'verifying' | 'ready' | 'expired_or_invalid' | 'password_updated_signout_pending'>('idle');
  const explicitRecoveryErrorRef = React.useRef<boolean>(false);
  const recoveryUserIdRef = React.useRef<string | null>(null);
  const passwordAlreadyUpdatedRef = React.useRef<boolean>(false);

  const updateRecoveryState = useCallback((newState: 'idle' | 'verifying' | 'ready' | 'expired_or_invalid' | 'password_updated_signout_pending') => {
    recoveryStateRef.current = newState;
    setRecoveryState(newState);
  }, []);

  const updateRecoveryMode = useCallback((newMode: boolean) => {
    isRecoveryModeRef.current = newMode;
    setIsRecoveryMode(newMode);
  }, []);

  // Concurrency-safe coordinator tracking generations and deduplicating in-flight requests
  const coordinator = useMemo(() => new SessionCoordinator<{ user: User; company: Company; billing?: any }>(), []);

  const handleImmediateLogout = useCallback(() => {
    coordinator.invalidate();
    setApiAccessToken('');
    setUser(null);
    setCompany(null);
    setBilling(null);
    setLoading(false);
  }, [coordinator]);

  const scheduleSync = useCallback(
    async (token: string, userId: string, isInitialRestoration = false): Promise<void> => {
      // If in recovery flow or explicit recovery error, NEVER schedule /api/auth/me sync
      if (isRecoveryModeRef.current || explicitRecoveryErrorRef.current) {
        return;
      }

      setApiAccessToken(token);

      // Only toggle global blocking loading on initial restoration or account switch, NEVER on background TOKEN_REFRESHED
      const currentActiveUser = coordinator.getActiveUserId();
      const isSwitchingAccount = currentActiveUser !== null && currentActiveUser !== userId;

      if (isInitialRestoration || isSwitchingAccount) {
        setLoading(true);
        if (isSwitchingAccount) {
          // Clear previous account data to avoid leaking previous user info while switching
          setUser(null);
          setCompany(null);
          setBilling(null);
        }
      }

      const syncResult = await coordinator.sync(token, userId, async (tk) => {
        return apiRequest<{ user: User; company: Company; billing?: any }>('/api/auth/me', {
          headers: { Authorization: `Bearer ${tk}` },
        });
      });

      // Discard stale responses from past generations or past accounts
      if (syncResult.cancelled) {
        return;
      }

      if (isInitialRestoration || isSwitchingAccount || coordinator.getActiveUserId() === userId) {
        setLoading(false);
      }

      if (syncResult.error) {
        setUser(null);
        setCompany(null);
        setBilling(null);
        const errMsg = syncResult.error.message || 'Falha ao sincronizar sessão com o servidor.';
        setError(errMsg);
        throw syncResult.error;
      }

      if (syncResult.data) {
        setUser(syncResult.data.user);
        setCompany(syncResult.data.company);
        setError(null);

        // Atualizar status de faturamento autenticado sem travar a interface
        try {
          const billingRes = await apiRequest<BillingStatus>('/api/billing/status', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (coordinator.getActiveUserId() === userId) {
            setBilling(billingRes);
          }
        } catch {
          if (syncResult.data.billing && coordinator.getActiveUserId() === userId) {
            setBilling(syncResult.data.billing as BillingStatus);
          }
        }
      }
    },
    [coordinator]
  );

  // Verificação assíncrona fora do listener síncrono para não travar o lock do Supabase Auth
  const verifyRecoverySessionAsync = useCallback((session: any) => {
    const verificationEpoch = coordinator.getGeneration();
    const isCurrentVerification = () => coordinator.getGeneration() === verificationEpoch &&
      isRecoveryModeRef.current && !passwordAlreadyUpdatedRef.current;
    setTimeout(async () => {
      if (!isCurrentVerification()) return;
      // Erro explícito de URL tem precedência permanente
      if (explicitRecoveryErrorRef.current) {
        updateRecoveryState('expired_or_invalid');
        setLoading(false);
        return;
      }

      if (!session?.access_token || !session?.user?.id) {
        updateRecoveryState('expired_or_invalid');
        setLoading(false);
        return;
      }

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isCurrentVerification() || explicitRecoveryErrorRef.current) return;

        if (userError || !userData?.user?.id || userData.user.id !== session.user.id) {
          updateRecoveryState('expired_or_invalid');
          setLoading(false);
          return;
        }

        recoveryUserIdRef.current = userData.user.id;
        updateRecoveryMode(true);
        updateRecoveryState('ready');
        setLoading(false);
      } catch {
        if (isCurrentVerification() && !explicitRecoveryErrorRef.current) {
          updateRecoveryState('expired_or_invalid');
          setLoading(false);
        }
      }
    }, 0);
  }, [coordinator, updateRecoveryMode, updateRecoveryState]);

  useEffect(() => {
    let isRecoveryFlow = false;
    if (typeof window !== 'undefined' && isRecoveryUrl()) {
      isRecoveryFlow = true;
      coordinator.invalidate();
      updateRecoveryMode(true);

      const errorCheck = isUrlExpiredOrError();
      if (errorCheck.isError) {
        explicitRecoveryErrorRef.current = true;
        updateRecoveryState('expired_or_invalid');
        setLoading(false);
      } else {
        updateRecoveryState('verifying');
      }
    }

    const initialEpoch = coordinator.getGeneration();

    // Initial session restoration
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If user logged out or coordinator was invalidated before getSession resolved, discard!
      if (coordinator.getGeneration() !== initialEpoch) {
        return;
      }

      // Explicit error in URL has permanent precedence: NEVER override with ready and NEVER bootstrap /api/auth/me
      if (explicitRecoveryErrorRef.current) {
        updateRecoveryState('expired_or_invalid');
        setLoading(false);
        return;
      }

      if (isRecoveryFlow || isRecoveryModeRef.current) {
        if (session?.access_token && session?.user?.id) {
          verifyRecoverySessionAsync(session);
        } else {
          updateRecoveryState('expired_or_invalid');
          setLoading(false);
        }
        return; // Intercept recovery session: NEVER bootstrap /api/auth/me during password recovery
      }

      if (session?.access_token && session?.user?.id) {
        scheduleSync(session.access_token, session.user.id, true).catch((err) => {
          console.warn('[TecniFlow Auth] Falha na restauração inicial da sessão:', err?.message || err);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => {
      if (coordinator.getGeneration() === initialEpoch) {
        if (isRecoveryFlow || isRecoveryModeRef.current) {
          updateRecoveryState('expired_or_invalid');
        }
        setLoading(false);
      }
    });

    // Supabase Auth listener: callback is strictly synchronous
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Explicit error has permanent precedence
      if (explicitRecoveryErrorRef.current) {
        updateRecoveryState('expired_or_invalid');
        setLoading(false);
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        coordinator.invalidate();
        updateRecoveryMode(true);
        if (!session || !session.access_token) {
          // PASSWORD_RECOVERY without valid session must NEVER turn into ready
          updateRecoveryState('expired_or_invalid');
          setLoading(false);
          return;
        }
        updateRecoveryState('verifying');
        verifyRecoverySessionAsync(session);
        return;
      }

      if (isRecoveryModeRef.current || (typeof window !== 'undefined' && isRecoveryUrl())) {
        coordinator.invalidate();
        if (session?.access_token && session?.user?.id) {
          if (recoveryStateRef.current === 'ready' && recoveryUserIdRef.current && session.user.id !== recoveryUserIdRef.current) {
            updateRecoveryState('expired_or_invalid');
            return;
          }
          if (recoveryStateRef.current === 'verifying') {
            verifyRecoverySessionAsync(session);
          }
        }
        return; // NEVER trigger scheduleSync('/api/auth/me') in recovery mode
      }

      if (session?.access_token && session?.user?.id) {
        // Trigger async sync outside listener callback; background refresh never sets global loading
        scheduleSync(session.access_token, session.user.id, false).catch((err) => {
          console.warn('[TecniFlow Auth] Falha na sincronização de evento de autenticação:', err?.message || err);
        });
      } else if (event === 'SIGNED_OUT') {
        handleImmediateLogout();
      }
    });

    return () => {
      coordinator.invalidate();
      subscription.unsubscribe();
    };
  }, [scheduleSync, handleImmediateLogout, coordinator, updateRecoveryMode, updateRecoveryState, verifyRecoverySessionAsync]);

  const login = async (email: string, password: string) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error: sbError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (sbError) {
      let msg = sbError.message;
      if (msg.includes('Invalid login credentials')) {
        msg = 'Credenciais inválidas. Verifique seu e-mail e senha.';
      } else if (msg.includes('Email not confirmed')) {
        msg = 'E-mail ainda não confirmado. Verifique sua caixa de entrada para ativar a conta.';
      }
      throw new Error(msg);
    }

    if (!data.session) {
      throw new Error('Sessão não iniciada. Verifique se a confirmação de e-mail é necessária.');
    }

    // Sincronização deduplicada pelo SessionCoordinator com propagação explícita de erro
    try {
      await scheduleSync(data.session.access_token, data.session.user.id, false);
    } catch (syncErr: any) {
      throw new Error(syncErr?.message || 'Falha ao sincronizar os dados da sua empresa no sistema.');
    }
  };

  const register = async (data: RegisterData): Promise<{ confirmationRequired: boolean }> => {
    setError(null);
    const normalizedEmail = data.ownerEmail.trim().toLowerCase();

    // Dedicated confirmation callback with URL validation and configurable override
    const confirmRedirectUrl = getSafeRedirectUrl(
      '/#auth-callback',
      typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_CONFIRM_REDIRECT_URL : undefined
    );

    const { data: sbData, error: sbError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: data.password,
      options: {
        data: {
          company_name: data.companyName.trim(),
          company_document: data.companyDocument ? data.companyDocument.trim() : '',
          company_phone: data.companyPhone ? data.companyPhone.trim() : '',
          company_whatsapp: data.companyWhatsapp ? data.companyWhatsapp.trim() : '',
          company_address: data.companyAddress ? data.companyAddress.trim() : '',
          owner_name: data.ownerName.trim(),
        },
        emailRedirectTo: confirmRedirectUrl,
      },
    });

    if (sbError) {
      let msg = sbError.message;
      if (msg.includes('User already registered')) {
        msg = 'Este e-mail já está cadastrado no sistema.';
      }
      throw new Error(msg);
    }

    if (sbData.session) {
      try {
        await scheduleSync(sbData.session.access_token, sbData.session.user.id, false);
        setConfirmationPendingEmail(null);
        return { confirmationRequired: false };
      } catch (syncErr: any) {
        throw new Error(
          `Sua conta foi criada no serviço de autenticação, mas houve uma falha ao vincular a empresa ao sistema: ${syncErr?.message || 'Falha de comunicação'}. Tente realizar o login ou contate o suporte.`
        );
      }
    } else {
      // If email confirmation is required by project settings
      setConfirmationPendingEmail(normalizedEmail);
      return { confirmationRequired: true };
    }
  };

  const logout = async () => {
    // Clear state and invalidate coordinator immediately
    handleImmediateLogout();
    setError(null);
    setConfirmationPendingEmail(null);
    updateRecoveryMode(false);
    updateRecoveryState('idle');
    explicitRecoveryErrorRef.current = false;
    recoveryUserIdRef.current = null;
    passwordAlreadyUpdatedRef.current = false;
    cleanAuthUrl();

    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[TecniFlow Auth] Erro ao deslogar no Supabase:', e);
    }

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {}
  };

  const exitRecoveryMode = useCallback(async (): Promise<{ success: boolean; error?: Error }> => {
    let signOutErr: any = null;
    try {
      const res = await supabase.auth.signOut();
      if (res?.error) {
        signOutErr = res.error;
      }
    } catch (err: any) {
      signOutErr = err;
    }

    if (signOutErr) {
      const errorMsg = 'Falha ao encerrar a sessão com segurança. Tente novamente.';
      setError(errorMsg);
      coordinator.invalidate();
      // Keep isRecoveryMode true so /api/auth/me bootstrap is strictly blocked!
      return { success: false, error: new Error(signOutErr.message || errorMsg) };
    }

    handleImmediateLogout();
    updateRecoveryMode(false);
    updateRecoveryState('idle');
    explicitRecoveryErrorRef.current = false;
    recoveryUserIdRef.current = null;
    passwordAlreadyUpdatedRef.current = false;
    cleanAuthUrl();
    return { success: true };
  }, [handleImmediateLogout, coordinator, updateRecoveryMode, updateRecoveryState]);

  const requestPasswordReset = async (email: string) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || normalizedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Informe um e-mail válido com no máximo 100 caracteres.');
    }

    // Dedicated password recovery callback with URL validation, preview blocking, and configurable override
    const envOverride = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SUPABASE_RESET_REDIRECT_URL : undefined;
    const resetRedirectUrl = resolveRecoveryRedirectUrl(envOverride);

    try {
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: resetRedirectUrl,
      });

      if (sbError) {
        const msg = sbError.message || '';
        const status = (sbError as any).status;
        const code = (sbError as any).code || (sbError as any).error_code || '';

        if (
          code === 'email_address_not_authorized' ||
          msg.toLowerCase().includes('email_address_not_authorized') ||
          msg.toLowerCase().includes('not authorized')
        ) {
          throw new Error('O envio de e-mails está indisponível no momento. Tente novamente mais tarde ou entre em contato com o suporte.');
        }

        if (
          status === 429 ||
          code === 'over_email_send_rate_limit' ||
          msg.toLowerCase().includes('rate limit') ||
          msg.toLowerCase().includes('too many requests') ||
          msg.toLowerCase().includes('over_email_send_rate_limit')
        ) {
          throw new Error('Muitas tentativas em pouco tempo. Aguarde alguns minutos antes de tentar novamente.');
        }

        if (
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('fetch') ||
          msg.toLowerCase().includes('failed to fetch') ||
          msg.toLowerCase().includes('network unavailable')
        ) {
          throw new Error('Falha de conexão. Verifique sua internet e tente novamente.');
        }

        if (
          status === 500 ||
          msg.toLowerCase().includes('smtp') ||
          msg.toLowerCase().includes('internal server error') ||
          msg.toLowerCase().includes('error sending')
        ) {
          throw new Error('Erro no servidor de envio de e-mails. Tente novamente mais tarde.');
        }

        throw new Error(msg || 'Falha ao solicitar recuperação de senha.');
      }
    } catch (thrownErr: any) {
      const msg = String(thrownErr?.message || thrownErr || '');
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network unavailable')
      ) {
        throw new Error('Falha de conexão. Verifique sua internet e tente novamente.');
      }
      throw thrownErr;
    }
  };

  const updatePassword = async (newPassword: string) => {
    setError(null);

    if (!isRecoveryModeRef.current || recoveryStateRef.current !== 'ready' || !recoveryUserIdRef.current) {
      throw new Error('Abra um link de recuperação válido para definir uma nova senha.');
    }
    const expectedRecoveryUserId = recoveryUserIdRef.current;
    const updateEpoch = coordinator.getGeneration();
    const isCurrentRecovery = () => isRecoveryModeRef.current && recoveryStateRef.current === 'ready' &&
      !explicitRecoveryErrorRef.current && recoveryUserIdRef.current === expectedRecoveryUserId &&
      coordinator.getGeneration() === updateEpoch;

    // Impedir salvar senha novamente se já foi alterada no mesmo ciclo
    if (passwordAlreadyUpdatedRef.current) {
      throw new Error('A senha já foi alterada com sucesso. Finalize o encerramento da sessão temporária para entrar.');
    }

    if (explicitRecoveryErrorRef.current || (recoveryStateRef.current as string) === 'expired_or_invalid') {
      throw new Error('Sessão de recuperação expirada ou inválida. Solicite um novo link de recuperação.');
    }

    // Senhas podem conter espaços intencionais: não utilizar .trim()
    if (!newPassword || newPassword.length < 12) {
      throw new Error('A nova senha deve conter no mínimo 12 caracteres.');
    }

    // Verificar se há uma sessão de recuperação ativa autorizada e vinculada ao mesmo usuário
    const { data: { session } } = await supabase.auth.getSession();
    if (!isCurrentRecovery() || !session || session.user?.id !== expectedRecoveryUserId) {
      updateRecoveryState('expired_or_invalid');
      throw new Error('Sessão de recuperação expirada ou inválida. Solicite um novo link de recuperação.');
    }

    const { data: verifiedUserData, error: verifyUserError } = await supabase.auth.getUser();
    if (!isCurrentRecovery() || verifyUserError || verifiedUserData?.user?.id !== expectedRecoveryUserId) {
      updateRecoveryState('expired_or_invalid');
      throw new Error('Sessão de recuperação expirada ou inválida. Solicite um novo link de recuperação.');
    }

    const { error: sbError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (sbError) {
      const msg = sbError.message || '';
      if (msg.toLowerCase().includes('same as') || msg.toLowerCase().includes('should be different') || msg.toLowerCase().includes('different from')) {
        throw new Error('A nova senha deve ser diferente da anterior.');
      }
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('jwt')) {
        updateRecoveryState('expired_or_invalid');
        throw new Error('Sessão expirada. Solicite um novo link de recuperação.');
      }
      throw new Error(msg || 'Falha ao redefinir a nova senha.');
    }

    // Senha gravada com sucesso! Marcar para impedir nova gravação
    passwordAlreadyUpdatedRef.current = true;

    // Encerrar sessão temporária tratando tanto exceptions quanto o objeto de retorno { error }
    let signOutErr: any = null;
    try {
      const res = await supabase.auth.signOut();
      if (res?.error) {
        signOutErr = res.error;
      }
    } catch (err: any) {
      signOutErr = err;
    }

    if (signOutErr) {
      // Falha ao encerrar: NUNCA permitir bootstrap de /api/auth/me nem exibir dashboard
      coordinator.invalidate();
      cleanAuthUrl();
      updateRecoveryState('password_updated_signout_pending');
      const msg = 'Sua senha foi alterada com sucesso, mas a conexão falhou ao encerrar a sessão temporária. Clique no botão para concluir com segurança.';
      setError(msg);
      throw new Error(msg);
    }

    // Sucesso: revoga a sessão temporária de recuperação, limpa a URL e retorna à tela de login
    handleImmediateLogout();
    updateRecoveryMode(false);
    updateRecoveryState('idle');
    explicitRecoveryErrorRef.current = false;
    recoveryUserIdRef.current = null;
    passwordAlreadyUpdatedRef.current = false;
    cleanAuthUrl();
  };

  const updateCompany = async (data: Partial<Company>) => {
    const res = await apiRequest<{ message: string; company: Company }>('/api/company', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    setCompany(res.company);
  };

  const updateCompanyLogo = async (logoDataUrl: string | null) => {
    const requestToken = coordinator.getActiveToken();
    const requestUserId = coordinator.getActiveUserId();
    const res = await apiRequest<{ message?: string; company: Company }>('/api/company/logo', {
      method: 'PUT',
      body: JSON.stringify({ logo_data_url: logoDataUrl }),
    });
    if (requestToken !== coordinator.getActiveToken() || requestUserId !== coordinator.getActiveUserId()) return;
    if (res?.company) {
      setCompany(res.company);
    } else {
      // In case the response is the raw company object
      setCompany((prev) => (prev ? { ...prev, company_logo_data_url: logoDataUrl } : prev));
    }
  };

  const refreshAuth = async () => {
    const token = coordinator.getActiveToken();
    const userId = coordinator.getActiveUserId();
    if (token && userId) {
      await scheduleSync(token, userId, false);
    }
  };

  const refreshBilling = useCallback(async (): Promise<BillingStatus | null> => {
    const token = coordinator.getActiveToken();
    const userId = coordinator.getActiveUserId();
    const epoch = coordinator.getGeneration();
    if (!token || !userId) return null;
    const isCurrentSession = () => coordinator.getActiveUserId() === userId &&
      coordinator.getActiveToken() === token && coordinator.getGeneration() === epoch;
    try {
      const data = await apiRequest<BillingStatus>('/api/billing/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!isCurrentSession()) return null;
      setBilling(data);
      return data;
    } catch {
      if (isCurrentSession()) setBilling(null);
      return null;
    }
  }, [coordinator]);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        billing,
        loading,
        error,
        isRecoveryMode,
        recoveryState,
        confirmationPendingEmail,
        login,
        register,
        logout,
        requestPasswordReset,
        updatePassword,
        updateCompany,
        updateCompanyLogo,
        refreshAuth,
        refreshBilling,
        clearConfirmationPending: () => setConfirmationPendingEmail(null),
        exitRecoveryMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

