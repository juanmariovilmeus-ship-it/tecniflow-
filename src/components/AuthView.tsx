import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Mail,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TecniFlowLogo } from './TecniFlowLogo';

export const AuthView: React.FC = () => {
  const {
    login,
    register,
    requestPasswordReset,
    verifyRecoveryOtp,
    updatePassword,
    isRecoveryMode,
    recoveryState,
    confirmationPendingEmail,
    clearConfirmationPending,
    exitRecoveryMode,
    error: contextError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Recovery request & OTP verification state with 60s cooldown timer
  const [showForgotView, setShowForgotView] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify_code'>('request');
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  React.useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Password reset state (when entering via recovery link)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [companyName, setCompanyName] = useState('');
  const [companyDocument, setCompanyDocument] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const activeDisplayError = errorMsg || contextError;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao autenticar. Verifique seus dados de acesso.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = ownerEmail.trim();
    if (!trimmedEmail || trimmedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Informe um e-mail válido com no máximo 100 caracteres.');
      return;
    }

    if (registerPassword.length < 12) {
      setErrorMsg('A senha deve conter no mínimo 12 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        companyName,
        companyDocument,
        companyPhone,
        companyWhatsapp,
        companyAddress,
        ownerName,
        ownerEmail: trimmedEmail,
        password: registerPassword,
      });

      if (!res.confirmationRequired) {
        setSuccessMsg('Cadastro realizado com sucesso! Carregando painel...');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao cadastrar assistência técnica.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || cooldownSeconds > 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail || trimmedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Informe um e-mail válido com no máximo 100 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSuccessMsg('Se existir uma conta com este e-mail, enviamos o código e as instruções de recuperação. Confira também o spam.');
      setCooldownSeconds(60);
      setRecoveryCode('');
      setForgotStep('verify_code');
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        !msg ||
        msg.includes('publicado') ||
        msg.includes('Origem de redirecionamento') ||
        msg.includes('Falha ao solicitar')
      ) {
        setErrorMsg('Não foi possível enviar o link agora. Tente novamente mais tarde.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (submitting || cooldownSeconds > 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail || trimmedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Informe um e-mail válido com no máximo 100 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSuccessMsg('Se existir uma conta com este e-mail, enviamos um novo código de recuperação. Confira também o spam.');
      setCooldownSeconds(60);
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        !msg ||
        msg.includes('publicado') ||
        msg.includes('Origem de redirecionamento') ||
        msg.includes('Falha ao solicitar')
      ) {
        setErrorMsg('Não foi possível enviar o link agora. Tente novamente mais tarde.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail || trimmedEmail.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Informe um e-mail válido com no máximo 100 caracteres.');
      return;
    }

    const cleanCode = recoveryCode.trim();
    if (!cleanCode) {
      setErrorMsg('Digite o código de recuperação enviado para o seu e-mail.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyRecoveryOtp(trimmedEmail, cleanCode);
      setRecoveryCode('');
      setShowForgotView(false);
      setForgotStep('request');
      setErrorMsg(null);
      setSuccessMsg('Código confirmado! Defina sua nova senha abaixo.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Código inválido ou expirado. Confira o código digitado ou solicite um novo envio.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Senhas podem conter espaços: não realizar trim
    if (newPassword.length < 12) {
      setErrorMsg('A nova senha deve conter no mínimo 12 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('A confirmação de senha não confere com a nova senha digitada.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
      setRecoveryCode('');
      setForgotStep('request');
      setSuccessMsg('Sua senha foi redefinida com sucesso! Faça login com a nova senha.');
      setActiveTab('login');
      setShowForgotView(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao redefinir a nova senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-3">
          <TecniFlowLogo variant="full" size="md" withBadge />
        </div>
        <p className="mt-2 text-center text-sm text-slate-400">
          Gestão profissional para assistência técnica de celulares e computadores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          {/* Notifications */}
          {activeDisplayError && (
            <div role="alert" aria-live="assertive" className="mb-6 p-3.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{activeDisplayError}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" aria-live="polite" className="mb-6 p-3.5 rounded-lg bg-teal-950/60 border border-teal-700 text-teal-200 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW: Email Confirmation Pending */}
          {confirmationPendingEmail ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-teal-900/60 border border-teal-700 flex items-center justify-center mx-auto text-teal-300">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Confirmação de E-mail Necessária</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Um link de ativação foi enviado para{' '}
                <strong className="text-teal-400 font-semibold">{confirmationPendingEmail}</strong>.
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Por favor, verifique sua caixa de entrada e clique no link de ativação antes de entrar no sistema.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => {
                    clearConfirmationPending();
                    setActiveTab('login');
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para a Tela de Login</span>
                </button>
              </div>
            </div>
          ) : isRecoveryMode && recoveryState === 'verifying' ? (
            /* VIEW: Verifying Recovery Token or Code */
            <div role="status" aria-live="polite" className="space-y-4 text-center py-8">
              <div className="w-12 h-12 rounded-full bg-teal-900/60 border border-teal-700 flex items-center justify-center mx-auto text-teal-300 animate-spin">
                <RefreshCw className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white">Verificando Credenciais de Recuperação</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Validando suas credenciais temporárias de segurança...
              </p>
            </div>
          ) : isRecoveryMode && recoveryState === 'expired_or_invalid' ? (
            /* VIEW: Expired or Invalid Recovery Link */
            <div className="space-y-4 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-rose-950/70 border border-rose-800 flex items-center justify-center mx-auto text-rose-300">
                <AlertCircle className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-bold text-white">Link ou Código Expirado ou Inválido</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                O acesso de recuperação utilizado expirou, já foi utilizado ou é inválido. Por motivos de segurança, solicite um novo código de recuperação para continuar.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-2.5 justify-center max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={async () => {
                    await exitRecoveryMode();
                    setForgotStep('request');
                    setRecoveryCode('');
                    setShowForgotView(true);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  <span>Solicitar Novo Código</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await exitRecoveryMode();
                    setShowForgotView(false);
                    setForgotStep('request');
                    setRecoveryCode('');
                    setActiveTab('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>Voltar ao Login</span>
                </button>
              </div>
            </div>
          ) : isRecoveryMode && recoveryState === 'password_updated_signout_pending' ? (
            /* VIEW: Password Updated, SignOut Pending */
            <div className="space-y-4 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-teal-950/70 border border-teal-700 flex items-center justify-center mx-auto text-teal-300">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Senha Alterada com Sucesso!</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                Sua nova senha foi salva. Por motivos de segurança, conclua o encerramento da sessão temporária para acessar o sistema com suas novas credenciais.
              </p>
              <div className="pt-4 flex flex-col sm:flex-row gap-2.5 justify-center max-w-sm mx-auto">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    setSubmitting(true);
                    setErrorMsg(null);
                    try {
                      const res = await exitRecoveryMode();
                      if (res.success) {
                        setActiveTab('login');
                        setShowForgotView(false);
                        setSuccessMsg('Sua senha foi redefinida com sucesso! Faça login com a nova senha.');
                      } else if (res.error) {
                        setErrorMsg(res.error.message || 'Falha ao encerrar sessão. Tente novamente.');
                      }
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{submitting ? 'Encerrando sessão...' : 'Concluir e Ir para Login'}</span>
                </button>
              </div>
            </div>
          ) : isRecoveryMode ? (
            /* VIEW: Password Reset (Verified Recovery Session via OTP or Link) */
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="border-b border-slate-700/80 pb-3 mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-teal-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Definir Nova Senha</h3>
                  <p id="reset-password-hint" className="text-xs text-slate-400 mt-0.5">
                    Digite a sua nova senha de acesso ao sistema (mínimo de 12 caracteres).
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="reset-new-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nova Senha (mínimo 12 caracteres) *
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    name="new-password"
                    type={showResetNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    aria-describedby="reset-password-hint"
                    minLength={12}
                    maxLength={72}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite sua nova senha forte"
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetNewPassword((prev) => !prev)}
                    aria-label={showResetNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showResetNewPassword}
                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-r-lg transition-colors"
                  >
                    {showResetNewPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Confirmar Nova Senha *
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm-password"
                    name="confirm-new-password"
                    type={showResetConfirmPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={72}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha digitada"
                    className="w-full pl-3.5 pr-11 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                    aria-label={showResetConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    aria-pressed={showResetConfirmPassword}
                    className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-r-lg transition-colors"
                  >
                    {showResetConfirmPassword ? (
                      <EyeOff className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Salvando nova senha...' : 'Salvar Nova Senha'}
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await exitRecoveryMode();
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowResetNewPassword(false);
                    setShowResetConfirmPassword(false);
                    setRecoveryCode('');
                    setForgotStep('request');
                    setShowForgotView(false);
                    setActiveTab('login');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : showForgotView && forgotStep === 'verify_code' ? (
            /* VIEW: Enter Recovery OTP Code */
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div className="border-b border-slate-700/80 pb-3 mb-2 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-teal-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Digite o Código Recebido</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Informe o código de recuperação enviado por e-mail para liberar a criação da nova senha.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="recovery-otp-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    E-mail Cadastrado *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('request');
                      setRecoveryCode('');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                  >
                    Alterar e-mail
                  </button>
                </div>
                <input
                  id="recovery-otp-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={100}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label htmlFor="recovery-otp-code" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Código de Recuperação *
                </label>
                <input
                  id="recovery-otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  aria-describedby="recovery-otp-hint"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="Digite o código recebido no e-mail"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm tracking-widest font-mono"
                />
                <p id="recovery-otp-hint" className="text-[11px] text-slate-400 mt-1.5">
                  Confira sua caixa de entrada e a pasta de spam. O código tem validade limitada.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={submitting || !recoveryCode.trim()}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Verificando código...' : 'Verificar Código'}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={submitting || cooldownSeconds > 0}
                  onClick={handleResendCode}
                  className="py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {cooldownSeconds > 0 ? `Reenviar em ${cooldownSeconds}s` : 'Reenviar código'}
                </button>
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotView(false);
                    setForgotStep('request');
                    setRecoveryCode('');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Voltar ao Login</span>
                </button>
              </div>
            </form>
          ) : showForgotView ? (
            /* VIEW: Request Password Reset */
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div className="border-b border-slate-700/80 pb-3 mb-2 flex items-center gap-2">
                <Mail className="w-5 h-5 text-teal-400" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Recuperar Senha de Acesso</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enviaremos um código e as instruções de recuperação para o e-mail cadastrado.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  E-mail Cadastrado *
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={100}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="submit"
                  disabled={submitting || cooldownSeconds > 0}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting
                    ? 'Enviando código...'
                    : cooldownSeconds > 0
                    ? `Aguarde ${cooldownSeconds}s para reenviar`
                    : 'Enviar Código de Recuperação'}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotView(false);
                    setForgotStep('request');
                    setRecoveryCode('');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm transition-colors"
                >
                  Voltar ao Login
                </button>
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep('verify_code');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-teal-400 hover:text-teal-300 underline transition-colors"
                >
                  Já tenho um código de recuperação
                </button>
              </div>
            </form>
          ) : (
            /* VIEW: Standard Tabs (Login / Register) */
            <>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-900/80 p-1.5 rounded-lg border border-slate-700/70 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setShowLoginPassword(false);
                    setShowRegisterPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-all text-center flex items-center justify-center ${
                    activeTab === 'login'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="hidden sm:inline">Acessar Conta</span>
                  <span className="sm:hidden">Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setShowLoginPassword(false);
                    setShowRegisterPassword(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-all text-center flex items-center justify-center ${
                    activeTab === 'register'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="hidden sm:inline">Cadastrar Assistência</span>
                  <span className="sm:hidden">Cadastrar</span>
                </button>
              </div>

              {activeTab === 'login' ? (
                /* Login Form */
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      E-mail do Proprietário
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="E-mail de acesso cadastrado"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(loginEmail);
                          setForgotStep('request');
                          setRecoveryCode('');
                          setShowLoginPassword(false);
                          setShowForgotView(true);
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Sua senha de acesso"
                        className="w-full pl-3.5 pr-11 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((prev) => !prev)}
                        aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showLoginPassword}
                        className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-r-lg transition-colors"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? 'Verificando credenciais...' : 'Entrar no Sistema'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                /* Registration Form */
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="border-b border-slate-700/80 pb-3 mb-2">
                    <h3 className="text-sm font-semibold text-slate-200">Dados da Assistência Técnica</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cadastro seguro para gestão da assistência técnica com controle por empresa.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="reg-company-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Nome da Empresa / Nome Fantasia *
                    </label>
                    <input
                      id="reg-company-name"
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Nome fantasia da sua assistência técnica"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-company-doc" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        CNPJ ou CPF
                      </label>
                      <input
                        id="reg-company-doc"
                        type="text"
                        value={companyDocument}
                        onChange={(e) => setCompanyDocument(e.target.value)}
                        placeholder="Documento fiscal da empresa"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-company-phone" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Telefone de Contato
                      </label>
                      <input
                        id="reg-company-phone"
                        type="tel"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        placeholder="Telefone comercial"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-company-whatsapp" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        WhatsApp Comercial
                      </label>
                      <input
                        id="reg-company-whatsapp"
                        type="tel"
                        value={companyWhatsapp}
                        onChange={(e) => setCompanyWhatsapp(e.target.value)}
                        placeholder="WhatsApp para atendimento comercial"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-company-address" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Endereço Completo
                      </label>
                      <input
                        id="reg-company-address"
                        type="text"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        placeholder="Logradouro, número, bairro, cidade e estado"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                  </div>

                  <div className="border-b border-slate-700/80 pb-3 pt-2 mb-2">
                    <h3 className="text-sm font-semibold text-slate-200">Dados do Proprietário / Administrador</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-owner-name" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Nome Completo *
                      </label>
                      <input
                        id="reg-owner-name"
                        type="text"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="Nome completo do responsável"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-owner-email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        E-mail de Acesso *
                      </label>
                      <input
                        id="reg-owner-email"
                        type="email"
                        required
                        maxLength={100}
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="E-mail principal para login"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-owner-password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Senha de Acesso (mínimo 12 caracteres) *
                    </label>
                    <div className="relative">
                      <input
                        id="reg-owner-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        required
                        minLength={12}
                        maxLength={72}
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="Digite ao menos 12 caracteres"
                        className="w-full pl-3.5 pr-11 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((prev) => !prev)}
                        aria-label={showRegisterPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showRegisterPassword}
                        className="absolute inset-y-0 right-0 px-3 flex items-center justify-center text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-r-lg transition-colors"
                      >
                        {showRegisterPassword ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting ? 'Processando cadastro...' : 'Concluir Cadastro'}
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Shield className="w-3.5 h-3.5 text-teal-400" />
            <span>Acesso seguro com controle exclusivo por empresa</span>
          </div>
        </div>
      </div>
    </div>
  );
};
