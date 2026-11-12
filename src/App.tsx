import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './components/AuthView';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { ClientsView } from './components/ClientsView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SubscriptionView } from './components/SubscriptionView';
import { HelpCenterView } from './components/HelpCenterView';
import { NewOrderModal } from './components/NewOrderModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { PrintOrderView } from './components/PrintOrderView';
import { Order, OrderServiceItem, OrderPartItem } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TecniFlowLogo } from './components/TecniFlowLogo';
import { Menu, Wrench, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, company, billing, loading, isRecoveryMode, refreshBilling } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals & Subviews
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const handleDataMutated = () => setDataVersion(v => v + 1);

  // Print Mode State
  const [printData, setPrintData] = useState<{
    order: Order;
    services: OrderServiceItem[];
    parts: OrderPartItem[];
  } | null>(null);

  // 1. Atualizar billing ao retornar foco para a aplicação (janela visível)
  useEffect(() => {
    const handleFocus = () => {
      refreshBilling();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshBilling();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshBilling]);

  // 2. Timer exato para revalidar status no momento do término do trial ou vencimento da assinatura
  useEffect(() => {
    if (!billing) return;
    const targetDateStr = billing.status === 'trial' ? billing.trial_ends_at : billing.current_period_ends_at;
    if (!targetDateStr) return;

    const msUntilExpiry = new Date(targetDateStr).getTime() - new Date(billing.server_time).getTime();
    if (msUntilExpiry > 0 && msUntilExpiry < 2147483647) {
      const timer = setTimeout(() => {
        refreshBilling();
      }, msUntilExpiry + 1000);
      return () => clearTimeout(timer);
    }
  }, [billing?.trial_ends_at, billing?.current_period_ends_at, billing?.status, refreshBilling]);

  // 3. Fechar imediatamente modais operacionais e impressão caso a assinatura expire
  useEffect(() => {
    if (!billing || !billing.is_active || billing.status === 'expired') {
      setIsNewOrderModalOpen(false);
      setIsOrderDetailOpen(false);
      setActiveOrderId(null);
      setPrintData(null);
    }
  }, [billing?.is_active, billing?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="p-2.5 rounded-2xl bg-white shadow-xl border border-slate-700/50 mb-3 animate-pulse">
          <TecniFlowLogo variant="icon" size="sm" />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-300">Carregando TecniFlow...</p>
      </div>
    );
  }

  // When in password recovery mode, render AuthView to allow resetting password before dashboard/print
  if (isRecoveryMode || !user) {
    return <AuthView />;
  }

  // If in print view mode
  if (printData && billing?.is_active) {
    return (
      <PrintOrderView
        order={printData.order}
        services={printData.services}
        parts={printData.parts}
        onBack={() => setPrintData(null)}
      />
    );
  }

  const handleOpenOrderDetail = (orderId: string) => {
    setActiveOrderId(orderId);
    setIsOrderDetailOpen(true);
  };

  const handlePrintOrder = (order: Order, services: OrderServiceItem[], parts: OrderPartItem[]) => {
    setPrintData({ order, services, parts });
  };

  const isOperationalTab = !['subscription', 'settings', 'help'].includes(activeTab);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Viewport Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800 no-print">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <TecniFlowLogo variant="horizontal" size="xs" withBadge />
          </div>

          <div className="flex items-center gap-2 max-w-[150px]">
            {company?.company_logo_data_url ? (
              <img
                src={company.company_logo_data_url}
                alt={company.name || 'Logotipo da assistência'}
                className="w-6 h-6 rounded-md object-contain bg-white border border-slate-700 p-0.5 shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-md bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300 text-[10px] font-bold shrink-0">
                {company?.name ? company.name.substring(0, 2).toUpperCase() : <Wrench className="w-3.5 h-3.5" />}
              </div>
            )}
            <span className="text-xs text-slate-300 font-medium truncate">
              {company?.name || 'Assistência'}
            </span>
          </div>
        </header>

        {/* Discrete Subscription Banners */}
        {billing?.status === 'trial' && billing?.is_active && (
          <div className="bg-teal-50 border-b border-teal-200 px-4 py-2 text-xs text-teal-800 flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>
                Período de avaliação gratuito: <strong>{billing.trial_days_remaining} {billing.trial_days_remaining === 1 ? 'dia restante' : 'dias restantes'}</strong>.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('subscription')}
              className="px-2.5 py-1 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition-colors shadow-2xs"
            >
              Assinar agora — R$ 49,90/mês
            </button>
          </div>
        )}

        {billing && (!billing.is_active || billing.status === 'expired') && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-2 no-print">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Acesso expirado:</strong> O período de teste chegou ao fim. Seus dados cadastrais e ordens de serviço continuam salvos e seguros.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('subscription')}
              className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition-colors shadow-2xs"
            >
              Regularizar Acesso
            </button>
          </div>
        )}

        {/* View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Caso 1: Billing nulo / status ainda desconhecido (bloqueia abas operacionais com aviso e botão repetir; não afirma expirado) */}
          {!billing && isOperationalTab ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 text-center space-y-4 max-w-md mx-auto my-12">
              <div className="w-10 h-10 rounded-full bg-slate-50 text-teal-600 flex items-center justify-center mx-auto">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Verificando autorização de acesso...</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Não foi possível confirmar seu acesso neste momento. Verifique sua conexão e tente novamente. Seus dados continuam salvos.
              </p>
              <button
                type="button"
                onClick={() => refreshBilling()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : billing && (!billing.is_active || billing.status === 'expired') && isOperationalTab ? (
            /* Caso 2: Confirmadamente expirado pelo servidor */
            <div className="bg-white rounded-xl border border-rose-200 shadow-sm p-8 text-center space-y-4 max-w-2xl mx-auto my-8">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Período de Avaliação Expirado</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                O período de teste gratuito da sua assistência técnica chegou ao fim. Para continuar cadastrando ordens de serviço, clientes e peças, ative sua assinatura. Todos os seus dados anteriores continuam preservados com total segurança.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('subscription')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Regularizar Assinatura (R$ 49,90/mês)
                </button>
              </div>
            </div>
          ) : (
            /* Caso 3: Acesso regular ou visualização de abas permitidas (subscription / settings) */
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  onNewOrder={() => setIsNewOrderModalOpen(true)}
                  onNewClient={() => setActiveTab('clients')}
                  onNewItem={() => setActiveTab('inventory')}
                  onViewOrder={handleOpenOrderDetail}
                  onNavigateToOrders={() => setActiveTab('orders')}
                  refreshTrigger={dataVersion}
                />
              )}

              {activeTab === 'orders' && (
                <OrdersView
                  onNewOrder={() => setIsNewOrderModalOpen(true)}
                  onViewOrder={handleOpenOrderDetail}
                  refreshTrigger={dataVersion}
                />
              )}

              {activeTab === 'clients' && (
                <ClientsView
                  onSelectOrder={handleOpenOrderDetail}
                  refreshTrigger={dataVersion}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  refreshTrigger={dataVersion}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView />
              )}

              {activeTab === 'settings' && (
                <SettingsView />
              )}

              {activeTab === 'subscription' && (
                <SubscriptionView />
              )}

              {activeTab === 'help' && (
                <HelpCenterView key={`${user.id}:${company?.id || ''}`} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onSuccess={(newOrderId) => {
          handleDataMutated();
          handleOpenOrderDetail(newOrderId);
        }}
      />

      <OrderDetailModal
        orderId={activeOrderId}
        isOpen={isOrderDetailOpen}
        onClose={() => {
          setIsOrderDetailOpen(false);
          setActiveOrderId(null);
          handleDataMutated();
        }}
        onPrint={handlePrintOrder}
        onRefreshList={handleDataMutated}
      />
    </div>
  );
};

const AuthScreenWrapper: React.FC = () => {
  const { user, company } = useAuth();
  const appKey = user?.id ? `user-session-${user.id}:${company?.id || ''}` : 'session-disconnected';
  return (
    <ErrorBoundary resetKey={appKey}>
      <MainApp key={appKey} />
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AuthScreenWrapper />
    </AuthProvider>
  );
}
