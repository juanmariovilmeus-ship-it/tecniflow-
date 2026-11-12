import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  PackageCheck,
  BarChart3,
  Settings,
  LogOut,
  Wrench,
  X,
  CreditCard,
  HelpCircle
} from 'lucide-react';
import { TecniFlowLogo } from './TecniFlowLogo';

export type ActiveTab = 'dashboard' | 'orders' | 'clients' | 'inventory' | 'reports' | 'subscription' | 'settings' | 'help';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  setMobileOpen
}) => {
  const { user, company, billing, logout } = useAuth();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Painel', icon: LayoutDashboard },
    { id: 'orders' as ActiveTab, label: 'Ordens de Serviço', icon: ClipboardList },
    { id: 'clients' as ActiveTab, label: 'Clientes', icon: Users },
    { id: 'inventory' as ActiveTab, label: 'Estoque de Peças', icon: PackageCheck },
    { id: 'reports' as ActiveTab, label: 'Relatórios de Atendimento', icon: BarChart3 },
    { id: 'subscription' as ActiveTab, label: 'Minha Assinatura', icon: CreditCard },
    { id: 'settings' as ActiveTab, label: 'Configurações', icon: Settings },
    { id: 'help' as ActiveTab, label: 'Central de Ajuda', icon: HelpCircle },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const getInitials = (name?: string) => {
    if (!name || !name.trim()) return null;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };
  const initials = getInitials(company?.name);

  const content = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800">
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <TecniFlowLogo variant="horizontal" size="sm" withBadge />
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Fechar menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shop / Company Identity */}
        <div className="flex items-center gap-2.5 pt-2.5 border-t border-slate-800/80">
          {company?.company_logo_data_url ? (
            <img
              src={company.company_logo_data_url}
              alt={company.name || 'Logotipo da assistência'}
              className="w-7 h-7 rounded-md object-contain bg-white border border-slate-700 p-0.5 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-md bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-xs shrink-0 font-bold text-xs tracking-wider">
              {initials || <Wrench className="w-3.5 h-3.5" />}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[175px]" title={company?.name}>
              {company?.name || 'Assistência Técnica'}
            </span>
            <span className="text-[10px] text-teal-400 font-medium">Empresa ativa</span>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-left whitespace-nowrap ${
                isActive
                  ? 'bg-teal-600/20 text-teal-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.id === 'subscription' && billing?.status === 'trial' && billing?.is_active && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {billing.trial_days_remaining}d
                </span>
              )}
              {item.id === 'subscription' && (billing?.status === 'expired' || (billing && !billing.is_active && billing.status !== 'trial')) && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Expirado
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Administrador'}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Sair do sistema"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 h-screen sticky top-0 no-print">
        {content}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 z-50 transform transition-transform duration-200 ease-in-out md:hidden no-print ${
          mobileOpen ? 'translate-x-0' : '-translate-x-0 -translate-x-full'
        }`}
      >
        {content}
      </div>
    </>
  );
};
