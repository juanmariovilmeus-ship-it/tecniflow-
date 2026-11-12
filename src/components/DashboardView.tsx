import { CLOUD_OPERATIONS_ENABLED } from '../lib/api';
import React, { useEffect, useState } from 'react';
import { apiRequest, formatCurrency, statusLabel, priorityLabel, deviceTypeLabel } from '../lib/api';
import { DashboardMetrics, Order } from '../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlusCircle,
  UserPlus,
  PackagePlus,
  ArrowRight,
  ClipboardList,
  Wrench
} from 'lucide-react';

interface DashboardViewProps {
  onNewOrder: () => void;
  onNewClient: () => void;
  onNewItem: () => void;
  onViewOrder: (orderId: string) => void;
  onNavigateToOrders: () => void;
  refreshTrigger?: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNewOrder,
  onNewClient,
  onNewItem,
  onViewOrder,
  onNavigateToOrders,
  refreshTrigger
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const res = await apiRequest<{ metrics: DashboardMetrics; recentOrders: Order[] }>('/api/reports/dashboard');
      setMetrics(res.metrics);
      setRecentOrders(res.recentOrders || []);
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível carregar os dados.');
      console.error('Falha ao carregar métricas do painel:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshTrigger]);

  return (
    <div className="space-y-6">
      {!CLOUD_OPERATIONS_ENABLED && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block text-amber-950">Ambiente de Demonstração e Avaliação</span>
            <span>
              O TecniFlow está operando com armazenamento local nesta prévia. Seus cadastros de clientes, peças e ordens funcionam normalmente nesta sessão. A sincronização definitiva na nuvem com a sua conta será ativada após a validação do administrador.
            </span>
          </div>
        </div>
      )}
      {loadError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{loadError} <button type="button" onClick={()=>fetchDashboardData()} className="underline ml-2">Tentar novamente</button></div>}
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel Operacional</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento de ordens em andamento, aprovações de orçamento e entregas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNewOrder}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova OS</span>
          </button>
          <button
            onClick={onNewClient}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4 text-slate-500" />
            <span>Novo Cliente</span>
          </button>
          <button
            onClick={onNewItem}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium transition-colors"
          >
            <PackagePlus className="w-4 h-4 text-slate-500" />
            <span>Nova Peça</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Em Andamento */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Em Andamento</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics ? metrics.inProgressCount : 0}
            </span>
            <span className="text-xs text-slate-500">aparelhos na bancada</span>
          </div>
        </div>

        {/* Aguardando Aprovação */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aguardando Aprovação</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics ? metrics.awaitingApprovalCount : 0}
            </span>
            <span className="text-xs text-slate-500">orçamentos pendentes</span>
          </div>
        </div>

        {/* Pronto para Retirada */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Prontos p/ Retirada</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {metrics ? metrics.readyForPickupCount : 0}
            </span>
            <span className="text-xs text-slate-500">reparo finalizado</span>
          </div>
        </div>

        {/* Serviços Entregues */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Serviços Entregues</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex flex-col">
            <span className="text-2xl font-bold text-teal-700 font-mono tabular-nums">
              {formatCurrency(metrics?.totalDeliveredCents || 0)}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              total de ordens finalizadas e entregues
            </span>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Últimas Ordens de Serviço</h2>
            <p className="text-xs text-slate-500">Acompanhamento dos atendimentos mais recentes</p>
          </div>
          <button
            onClick={onNavigateToOrders}
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
          >
            Ver todas
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando ordens...</div>
        ) : recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Nenhuma ordem de serviço cadastrada</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              Cadastre seu primeiro cliente e abra uma ordem de serviço para iniciar os atendimentos.
            </p>
            <button
              onClick={onNewOrder}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Abrir Primeira OS</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Aparelho</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900 tabular-nums">
                      #{String(order.order_number).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div>{order.client_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">{order.client_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium">{order.brand} {order.model}</div>
                      <div className="text-[11px] text-slate-400">{deviceTypeLabel(order.device_type)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`capitalize ${order.priority === 'urgente' ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
                        {priorityLabel(order.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(order.total_amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onViewOrder(order.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
