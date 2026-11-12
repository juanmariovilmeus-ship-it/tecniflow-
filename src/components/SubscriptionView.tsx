import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest, formatDate, formatDateTime, formatCurrency } from '../lib/api';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  Calendar,
  ExternalLink
} from 'lucide-react';

const isValidKiwifyCheckoutUrl = (urlStr?: string | null): boolean => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'pay.kiwify.com.br' &&
      parsed.searchParams.has('sck') &&
      Boolean(parsed.searchParams.get('sck')?.trim())
    );
  } catch {
    return false;
  }
};

export const SubscriptionView: React.FC = () => {
  const { user, billing, refreshBilling } = useAuth();
  const [loading, setLoading] = useState<boolean>(!billing);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackCheckoutUrl, setFallbackCheckoutUrl] = useState<string | null>(null);
  const [noticeModal, setNoticeModal] = useState<{
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
  } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await refreshBilling();
      if (!result) setErrorMsg('Não foi possível consultar sua assinatura. Verifique sua conexão e tente novamente.');
    } catch {
      setErrorMsg('Não foi possível carregar as informações da assinatura. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!billing) {
      fetchStatus();
    }
  }, []);

  const isOwner = user?.role === 'owner' || billing?.is_owner;
  const isExpired = !!billing && (billing.status === 'expired' || (!billing.is_active && billing.status !== 'trial'));
  const isTrial = billing?.status === 'trial' && billing?.is_active;
  const isActive = billing?.status === 'active' && billing.is_active;
  const isCanceled = billing?.status === 'canceled';

  const handleSubscribe = async () => {
    // Evita clique duplo ou execução se não for proprietário
    if (!isOwner || submitting) return;

    // Se já estiver ativo, não envia create-checkout para não duplicar assinaturas
    if (isActive) {
      setNoticeModal({
        title: 'Assinatura Ativa e Regular',
        message: 'Sua assinatura mensal de R$ 49,90 está confirmada e em dia. O gerenciamento ou cancelamento da assinatura é realizado diretamente através do link enviado no e-mail de confirmação da Kiwify.'
      });
      return;
    }

    // Abre janela vazia SINCRONAMENTE no clique para preservar o gesto do usuário
    // e remover o opener imediatamente para segurança
    let popup: Window | null = null;
    try {
      popup = window.open('about:blank', '_blank');
      if (popup) {
        popup.opener = null;
      }
    } catch {
      popup = null;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest<{ checkout_url?: string; error?: string; message?: string }>('/api/billing/create-checkout', {
        method: 'POST',
      });

      const checkoutUrl = res?.checkout_url;

      if (checkoutUrl && isValidKiwifyCheckoutUrl(checkoutUrl)) {
        setFallbackCheckoutUrl(checkoutUrl);

        let navigated = false;
        if (popup && !popup.closed) {
          try {
            popup.location.href = checkoutUrl;
            navigated = true;
          } catch {
            navigated = false;
          }
        }

        // Se o popup foi bloqueado pelo navegador ou fechado antes da resposta
        if (!navigated) {
          if (popup && !popup.closed) {
            try { popup.close(); } catch {}
          }
          setNoticeModal({
            title: 'Continuar para o Pagamento',
            message: 'O link seguro de pagamento foi gerado. Como a abertura automática foi bloqueada pelo navegador, clique abaixo para abrir a página oficial da Kiwify em uma nova aba:',
            actionUrl: checkoutUrl,
            actionLabel: 'Continuar para o pagamento',
          });
        }
        return;
      }

      // Se a resposta não contém URL válida, fecha a janela vazia
      if (popup && !popup.closed) {
        try { popup.close(); } catch {}
      }

      setNoticeModal({
        title: res?.error === 'trial_active' ? 'Período de Avaliação em Andamento' : 'Contratação em Fase de Ativação',
        message: res?.message || 'A contratação online por cartão está temporariamente em fase de configuração pela administração. Seus dados cadastrais e ordens de serviço continuam 100% seguros.'
      });
    } catch (err: any) {
      // Fecha a janela vazia se a API falhar
      if (popup && !popup.closed) {
        try { popup.close(); } catch {}
      }

      const isTrialActive = err?.error === 'trial_active' || err?.message?.includes('avaliação gratuita');
      setNoticeModal({
        title: isTrialActive ? 'Período de Avaliação em Andamento' : 'Contratação em Fase de Ativação',
        message: err?.message || 'A contratação online está temporariamente desativada pela administração. Seus dados cadastrais e ordens de serviço continuam 100% seguros.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!billing) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-xl font-bold text-slate-900">Minha Assinatura</h1>
        <div role="status" className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <RefreshCw className={`w-5 h-5 text-teal-600 ${loading ? 'animate-spin' : ''}`} />
          <h2 className="text-sm font-semibold text-slate-800">
            {loading ? 'Consultando sua assinatura...' : 'Informações temporariamente indisponíveis'}
          </h2>
          <p className="text-sm text-slate-600">
            {errorMsg || 'Aguarde enquanto confirmamos as informações do seu plano.'}
          </p>
          <button type="button" onClick={fetchStatus} disabled={loading}
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold disabled:opacity-50">
            {loading ? 'Consultando...' : 'Tentar novamente'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-teal-600" />
            Minha Assinatura
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerenciamento do plano da sua assistência técnica, período de teste e pagamentos
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors self-start sm:self-auto disabled:opacity-50 shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          <span>Atualizar status</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold">Falha ao carregar informações</p>
            <p className="mt-0.5 text-rose-700">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={fetchStatus}
            className="text-xs font-semibold text-rose-800 underline hover:no-underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Main Status Banner Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 flex-1">
              {/* Badge de Status */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
                {isTrial && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Período de Avaliação Gratuita (7 dias)
                  </span>
                )}
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assinatura Ativa
                  </span>
                )}
                {isCanceled && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    Cancelada (Acesso até o fim do ciclo pago)
                  </span>
                )}
                {isExpired && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Acesso Expirado
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Plano TecniFlow Mensal
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Acesso completo a todas as ferramentas operacionais, ordens de serviço, clientes e estoque.
                </p>
              </div>

              {/* Informações de Vigência e Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                {isTrial && (
                  <>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium">Dias restantes de teste:</span>
                        <p className="text-slate-900 font-bold text-sm">
                          {billing?.trial_days_remaining ?? 0} {billing?.trial_days_remaining === 1 ? 'dia corrido' : 'dias corridos'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-slate-500 font-medium">Término do período gratuito:</span>
                        <p className="text-slate-900 font-bold text-sm">
                          {billing?.trial_ends_at ? formatDateTime(billing.trial_ends_at) : 'Calculado pelo servidor'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {(isActive || isCanceled) && billing?.current_period_ends_at && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-500 font-medium">
                        {isCanceled ? 'Acesso garantido até:' : 'Próxima renovação:'}
                      </span>
                      <p className="text-slate-900 font-bold text-sm">
                        {formatDate(billing.current_period_ends_at)}
                      </p>
                    </div>
                  </div>
                )}

                {isExpired && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 flex items-start gap-2.5 sm:col-span-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-rose-700 font-bold">O período de avaliação gratuita terminou.</span>
                      <p className="text-rose-600 text-xs mt-0.5">
                        Seus dados, clientes e ordens de serviço continuam salvos e seguros. Para reativar o cadastro e movimentações diárias, assine o plano.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Price and Action Button */}
            <div className="flex flex-col items-start md:items-end justify-center p-5 rounded-xl bg-slate-50 border border-slate-200 shrink-0 min-w-[240px]">
              <span className="text-xs text-slate-500 font-medium">Valor da mensalidade:</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-extrabold text-slate-900">R$ 49,90</span>
                <span className="text-xs text-slate-500 font-medium">/ mês</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1">Uma assinatura mensal por empresa</span>

              <div className="w-full mt-4 space-y-2">
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSubscribe}
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
                    >
                      {submitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>{isActive ? 'Gerenciar Assinatura' : 'Assinar Agora'}</span>
                    </button>

                    {fallbackCheckoutUrl && (
                      <a
                        href={fallbackCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>Continuar para o pagamento</span>
                      </a>
                    )}
                  </>
                ) : (
                  <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] text-center">
                    Apenas o proprietário da assistência técnica pode gerenciar a contratação da assinatura.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Informações e Recursos Incluídos */}
        <div className="bg-slate-50/70 border-t border-slate-100 px-6 py-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            O que está incluído no seu plano:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Gestão de ordens de serviço e histórico</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Gestão completa de clientes e contatos</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Controle de estoque com baixa automática</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Relatórios gerenciais e ticket médio</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Impressão de OS com logotipo da empresa</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>Acesso seguro com controle de permissões</span>
            </div>
          </div>
        </div>

        {/* Informações sobre Funcionamento e Pagamento */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 space-y-2 text-xs text-slate-600">
          <h4 className="font-bold text-slate-800">Como funciona a sua assinatura:</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-600 leading-relaxed">
            <li>Você conta com 7 dias corridos gratuitos de avaliação no TecniFlow, iniciados no cadastro da sua assistência.</li>
            <li>Ao optar por assinar, o primeiro pagamento é processado imediatamente pela Kiwify para ativar o seu ciclo de assinatura.</li>
            <li>No cartão de crédito e no Pix Automático, as renovações mensais ocorrem automaticamente a cada ciclo após a sua autorização.</li>
            <li>No boleto bancário, a compensação ocorre via link do pedido enviado em cada vencimento.</li>
            <li>Para gerenciar sua forma de pagamento ou cancelar a qualquer momento, utilize o link seguro enviado pela Kiwify em seu e-mail.</li>
          </ul>
        </div>
      </div>

      {/* Payment History Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-600" />
            Histórico de Pagamentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Comprovantes e registros de cobrança confirmados pela instituição financeira
          </p>
        </div>

        {billing?.payments && billing.payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Valor</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billing.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono">{formatDateTime(p.payment_date)}</td>
                    <td className="py-2.5 px-3">Mensalidade TecniFlow</td>
                    <td className="py-2.5 px-3 font-semibold">{formatCurrency(p.amount_cents)}</td>
                    <td className="py-2.5 px-3 text-right">
                      {p.status === 'approved' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                          Confirmado
                        </span>
                      )}
                      {p.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700">
                          Pendente
                        </span>
                      )}
                      {p.status === 'rejected' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700">
                          Recusado
                        </span>
                      )}
                      {['refunded', 'charged_back'].includes(p.status) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                          Estornado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhum pagamento registrado até o momento.
          </div>
        )}
      </div>

      {/* Notice Modal */}
      {noticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">{noticeModal.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">{noticeModal.message}</p>
            <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
              {noticeModal.actionUrl && (
                <a
                  href={noticeModal.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setNoticeModal(null)}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>{noticeModal.actionLabel || 'Continuar para o pagamento'}</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setNoticeModal(null)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                  noticeModal.actionUrl
                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {noticeModal.actionUrl ? 'Fechar' : 'Entendi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
