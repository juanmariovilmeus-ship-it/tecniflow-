import React, { useState, useEffect } from 'react';
import { apiRequest, formatCurrency, statusLabel, priorityLabel, deviceTypeLabel } from '../lib/api';
import { Order, OrderStatus, OrderPriority } from '../types';
import {
  Search,
  PlusCircle,
  Filter,
  Eye,
  ClipboardList
} from 'lucide-react';

interface OrdersViewProps {
  onNewOrder: () => void;
  onViewOrder: (orderId: string) => void;
  refreshTrigger?: number;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  onNewOrder,
  onViewOrder,
  refreshTrigger,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('todas');

  const fetchOrders = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'todos') params.append('status', statusFilter);
      if (priorityFilter !== 'todas') params.append('priority', priorityFilter);

      const res = await apiRequest<{ orders: Order[] }>(`/api/orders?${params.toString()}`);
      setOrders(res.orders || []);
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível carregar os dados.');
      console.error('Falha ao listar ordens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOrders();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, priorityFilter, refreshTrigger]);

  return (
    <div className="space-y-5">
      {loadError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{loadError} <button type="button" onClick={()=>fetchOrders()} className="underline ml-2">Tentar novamente</button></div>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Ordens de Serviço</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie o ciclo de vida completo dos reparos da sua assistência técnica
          </p>
        </div>

        <button
          onClick={onNewOrder}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Ordem de Serviço</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por OS, cliente, telefone, marca, modelo ou IMEI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            >
              <option value="todos">Todos os status</option>
              <option value="recebido">Recebido</option>
              <option value="diagnostico">Diagnóstico</option>
              <option value="aguardando_aprovacao">Aguardando aprovação</option>
              <option value="reparo">Em reparo</option>
              <option value="pronto">Pronto para entrega</option>
              <option value="entregue">Entregue</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-600">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="min-w-0 w-full px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
            >
              <option value="todas">Todas as prioridades</option>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loadError ? <p className="p-6 text-sm text-slate-500">Os dados não estão disponíveis. Tente carregar novamente.</p> : loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando ordens de serviço...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search || statusFilter !== 'todos' ? 'Nenhuma OS encontrada para os filtros aplicados' : 'Nenhuma ordem de serviço cadastrada'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {search || statusFilter !== 'todos'
                ? 'Tente ajustar sua busca ou limpar os filtros de status.'
                : 'Cadastre sua primeira ordem de serviço para registrar equipamentos e orçamentos.'}
            </p>
            {!search && statusFilter === 'todos' && (
              <button
                onClick={onNewOrder}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nova Ordem de Serviço</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Aparelho</th>
                  <th className="px-4 py-3">Defeito Informado</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => onViewOrder(o.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 tabular-nums">
                      #{String(o.order_number).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{o.client_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">{o.client_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-800">{o.brand} {o.model}</div>
                      <div className="text-[11px] text-slate-400">{deviceTypeLabel(o.device_type)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={o.defect_reported}>
                      {o.defect_reported}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`capitalize ${o.priority === 'urgente' ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                        {priorityLabel(o.priority)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatCurrency(o.total_amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onViewOrder(o.id)}
                        className="p-1.5 rounded text-teal-600 hover:text-teal-800 hover:bg-teal-50 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
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
