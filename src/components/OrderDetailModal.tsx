import React, { useState, useEffect } from 'react';
import { apiRequest, formatCurrency, formatDateTime, statusLabel, priorityLabel, deviceTypeLabel } from '../lib/api';
import { Order, OrderServiceItem, OrderPartItem, OrderHistoryItem, InventoryItem, OrderStatus } from '../types';
import {
  X,
  Printer,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  AlertCircle,
  Clock,
  History,
  ShieldCheck,
  Package,
  Wrench,
  DollarSign,
  RotateCcw
} from 'lucide-react';

interface OrderDetailModalProps {
  orderId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onPrint: (order: Order, services: OrderServiceItem[], parts: OrderPartItem[]) => void;
  onRefreshList?: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  orderId,
  isOpen,
  onClose,
  onPrint,
  onRefreshList,
}) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [services, setServices] = useState<OrderServiceItem[]>([]);
  const [parts, setParts] = useState<OrderPartItem[]>([]);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable diagnosis
  const [diagnosis, setDiagnosis] = useState('');
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);

  // Cancellation modal
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellation, setSubmittingCancellation] = useState(false);

  // Delivery confirmation modal
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Budget editing state
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState(false);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [editServices, setEditServices] = useState<Array<{ description: string; unit_price_cents: number; quantity: number }>>([]);
  const [editParts, setEditParts] = useState<Array<{ inventory_item_id: string | null; description: string; unit_price_cents: number; quantity: number }>>([]);

  // Budget decision modal
  const [budgetDecisionNotes, setBudgetDecisionNotes] = useState('');

  const statusWorkflow: OrderStatus[] = [
    'recebido',
    'diagnostico',
    'aguardando_aprovacao',
    'reparo',
    'pronto',
    'entregue'
  ];

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderData();
      loadInventory();
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsEditingBudget(false);
    }
  }, [isOpen, orderId]);

  const loadOrderData = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await apiRequest<{
        order: Order;
        services: OrderServiceItem[];
        parts: OrderPartItem[];
        history: OrderHistoryItem[];
      }>(`/api/orders/${orderId}`);

      setOrder(res.order);
      setServices(res.services || []);
      setParts(res.parts || []);
      setHistory(res.history || []);
      setDiagnosis(res.order.technical_diagnosis || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar detalhes da ordem.');
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      const res = await apiRequest<{ items: InventoryItem[] }>('/api/inventory');
      setInventoryList(res.items || []);
    } catch (e: any) {
      console.warn('Falha ao carregar estoque para seleção de peças:', e);
    }
  };

  const handleSaveDiagnosis = async () => {
    if (!order) return;
    setSavingDiagnosis(true);
    setErrorMsg(null);
    try {
      await apiRequest(`/api/orders/${order.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          deviceType: order.device_type,
          brand: order.brand,
          model: order.model,
          serialImei: order.serial_imei,
          defectReported: order.defect_reported,
          accessories: order.accessories,
          entryCondition: order.entry_condition,
          technicalDiagnosis: diagnosis,
          priority: order.priority,
          estimatedDelivery: order.estimated_delivery,
          version: order.version
        })
      });
      setSuccessMsg('Diagnóstico técnico salvo com sucesso.');
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar diagnóstico.');
      if (err.message?.includes('modificada por outro')) {
        await loadOrderData();
      }
    } finally {
      setSavingDiagnosis(false);
    }
  };

  const handleStatusChange = async (nextStatus: OrderStatus) => {
    if (!order) return;
    if (nextStatus === 'cancelado') {
      setIsCancelModalOpen(true);
      return;
    }
    if (nextStatus === 'entregue') {
      setIsDeliveryModalOpen(true);
      return;
    }

    try {
      setSubmittingStatus(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: nextStatus,
          version: order.version
        })
      });
      setSuccessMsg(`Status avançado para "${statusLabel(nextStatus)}".`);
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar status.');
      if (err.message?.includes('modificada por outro')) {
        await loadOrderData();
      }
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!order || !cancellationReason.trim()) {
      setErrorMsg('Informe a justificativa para o cancelamento.');
      return;
    }

    try {
      setSubmittingCancellation(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'cancelado',
          cancellationReason: cancellationReason.trim(),
          version: order.version
        })
      });
      setIsCancelModalOpen(false);
      setCancellationReason('');
      setSuccessMsg('Ordem de serviço cancelada com justificativa gravada.');
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao cancelar OS.');
    } finally {
      setSubmittingCancellation(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order) return;
    try {
      setSubmittingDelivery(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/status`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'entregue',
          version: order.version
        })
      });
      setIsDeliveryModalOpen(false);
      setSuccessMsg('Entrega do equipamento ao cliente registrada com sucesso.');
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar entrega.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handleStartBudgetEdit = () => {
    setEditServices(
      services.map(s => ({
        description: s.description,
        unit_price_cents: s.unit_price_cents,
        quantity: s.quantity
      }))
    );
    setEditParts(
      parts.map(p => ({
        inventory_item_id: p.inventory_item_id || null,
        description: p.description,
        unit_price_cents: p.unit_price_cents,
        quantity: p.quantity
      }))
    );
    setIsEditingBudget(true);
  };

  const handleAddEditService = () => {
    setEditServices(prev => [...prev, { description: '', unit_price_cents: 0, quantity: 1 }]);
  };

  const handleRemoveEditService = (idx: number) => {
    setEditServices(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddEditPart = () => {
    setEditParts(prev => [...prev, { inventory_item_id: null, description: '', unit_price_cents: 0, quantity: 1 }]);
  };

  const handleSelectInventoryForPart = (idx: number, itemId: string) => {
    const item = inventoryList.find(i => i.id === itemId);
    if (!item) {
      setEditParts(prev => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          inventory_item_id: null
        };
        return copy;
      });
      return;
    }
    setEditParts(prev => {
      const copy = [...prev];
      copy[idx] = {
        inventory_item_id: item.id,
        description: item.name,
        unit_price_cents: item.sale_price_cents,
        quantity: 1
      };
      return copy;
    });
  };

  const handleRemoveEditPart = (idx: number) => {
    setEditParts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveBudget = async () => {
    if (!order) return;
    try {
      setSavingBudget(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/budget`, {
        method: 'PUT',
        body: JSON.stringify({
          services: editServices,
          parts: editParts,
          version: order.version
        })
      });
      setIsEditingBudget(false);
      setSuccessMsg('Orçamento recalculado pelo servidor e gravado com sucesso.');
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar orçamento.');
      if (err.message?.includes('modificada por outro')) {
        await loadOrderData();
      }
    } finally {
      setSavingBudget(false);
    }
  };

  const handleRequestBudgetRevision = async () => {
    if (!order) return;
    try {
      setSubmittingRevision(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/budget/revise`, {
        method: 'POST',
        body: JSON.stringify({
          version: order.version
        })
      });
      setSuccessMsg('Orçamento reaberto para revisão.');
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao reabrir orçamento.');
      if (err.message?.includes('modificada por outro')) {
        await loadOrderData();
      }
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleBudgetDecision = async (decision: 'aprovado' | 'recusado') => {
    if (!order) return;
    if (decision === 'aprovado' && (services.length + parts.length === 0 || order.total_amount_cents <= 0)) { setErrorMsg('Adicione serviços ou peças com valor antes de aprovar o orçamento.'); return; }
    try {
      setSubmittingDecision(true);
      setErrorMsg(null);
      await apiRequest(`/api/orders/${order.id}/budget/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          notes: budgetDecisionNotes.trim(),
          version: order.version
        })
      });
      setBudgetDecisionNotes('');
      setSuccessMsg(`Orçamento registrado como ${decision.toUpperCase()}.`);
      await loadOrderData();
      if (onRefreshList) onRefreshList();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar decisão de orçamento.');
      if (err.message?.includes('modificada por outro')) {
        await loadOrderData();
      }
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (!isOpen || !orderId) return null;

  const isTerminal = order?.status === 'entregue' || order?.status === 'cancelado';
  const hasDebitedParts = parts.some(p => p.inventory_debited === 1);
  const canEditBudget = !isTerminal && order?.status !== 'reparo' && order?.status !== 'pronto' && !hasDebitedParts;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
              OS #{order ? String(order.order_number).padStart(4, '0') : '...'}
            </span>
            {order && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-200 text-slate-800">
                {statusLabel(order.status)}
              </span>
            )}
            {order?.priority === 'urgente' && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                Urgente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <button
                type="button"
                onClick={() => onPrint(order, services, parts)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                title="Imprimir documento formatado A4"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir OS</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading || !order ? (
            <div className="py-12 text-center text-sm text-slate-400">Carregando dados da ordem...</div>
          ) : (
            <>
              {/* Status Flow Stepper */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Fluxo Operacional
                  </span>
                  {!isTerminal && (
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Cancelar OS
                    </button>
                  )}
                </div>

                {order.status === 'cancelado' ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-600" />
                      Ordem de Serviço Cancelada
                    </div>
                    <div><strong>Justificativa registrada:</strong> {order.cancellation_reason}</div>
                    {parts.some(p => p.inventory_debited === 1) && (
                      <div className="text-[11px] text-rose-700 pt-1 border-t border-rose-200/80">
                        <strong>Rastreabilidade de peças mantida:</strong> As peças baixadas na entrada em reparo continuam registradas no histórico. Caso o item tenha retornado à prateleira fisicamente, lance um ajuste manual com justificativa no módulo de Estoque.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 pt-1">
                    {statusWorkflow.map((st, idx) => {
                      const currentIndex = statusWorkflow.indexOf(order.status);
                      const isPast = idx < currentIndex;
                      const isCurrent = idx === currentIndex;
                      const isNext = idx === currentIndex + 1;
                      const canClick = isNext && (!isTerminal);
                      const isRepairBlocked = st === 'reparo' && order.budget_status !== 'aprovado';

                      return (
                        <button
                          key={st}
                          onClick={() => {
                            if (canClick && !isRepairBlocked && !submittingStatus) {
                              handleStatusChange(st);
                            }
                          }}
                          disabled={!canClick || isRepairBlocked || submittingStatus}
                          title={isRepairBlocked ? 'Orçamento precisa ser aprovado antes do reparo' : ''}
                          className={`p-2 rounded-lg text-left text-xs transition-all border ${
                            isCurrent
                              ? 'bg-teal-600 text-white border-teal-700 font-bold shadow-xs'
                              : isPast
                              ? 'bg-teal-50 text-teal-900 border-teal-200 font-medium'
                              : canClick && !isRepairBlocked
                              ? 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50 font-semibold cursor-pointer'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <div className="text-[10px] opacity-75">{idx + 1}. Passo</div>
                          <div className="truncate">{statusLabel(st)}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {order.status === 'aguardando_aprovacao' && order.budget_status !== 'aprovado' && (
                  <p className="text-[11px] text-amber-700 mt-2 font-medium">
                    Aguardando decisão do cliente. O reparo só poderá ser iniciado após aprovação do orçamento.
                  </p>
                )}
              </div>

              {/* Client & Equipment Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Dados do Cliente
                  </h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-semibold text-slate-900">{order.client_name}</p>
                    <p className="text-slate-600">Telefone: <span className="font-mono tabular-nums">{order.client_phone}</span></p>
                    {order.client_whatsapp && (
                      <p className="text-slate-600">WhatsApp: <span className="font-mono tabular-nums">{order.client_whatsapp}</span></p>
                    )}
                    {order.client_document && (
                      <p className="text-slate-600">CPF/CNPJ: <span className="font-mono tabular-nums">{order.client_document}</span></p>
                    )}
                    {order.client_email && (
                      <p className="text-slate-600">E-mail: {order.client_email}</p>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Aparelho & Triagem
                  </h4>
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-semibold text-slate-900">{order.brand} {order.model}</p>
                    <p className="text-slate-600">Tipo: {deviceTypeLabel(order.device_type)}</p>
                    {order.serial_imei && (
                      <p className="text-slate-600">IMEI / Serial: <span className="font-mono">{order.serial_imei}</span></p>
                    )}
                    <p className="text-slate-600">Previsão: {order.estimated_delivery ? formatDateTime(order.estimated_delivery) : 'Não informada'}</p>
                  </div>
                </div>
              </div>

              {/* Defect, Entry Condition, Accessories */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3 text-xs">
                <div>
                  <span className="font-bold text-slate-800">Defeito Relatado: </span>
                  <span className="text-slate-700">{order.defect_reported}</span>
                </div>
                {order.entry_condition && (
                  <div>
                    <span className="font-bold text-slate-800">Condição de Entrada / Vistoria: </span>
                    <span className="text-slate-700">{order.entry_condition}</span>
                  </div>
                )}
                {order.accessories && (
                  <div>
                    <span className="font-bold text-slate-800">Acessórios Deixados: </span>
                    <span className="text-slate-700">{order.accessories}</span>
                  </div>
                )}
              </div>

              {/* Technical Diagnosis */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-teal-600" />
                    Diagnóstico Técnico
                  </label>
                  {!isTerminal && (
                    <button
                      type="button"
                      onClick={handleSaveDiagnosis}
                      disabled={savingDiagnosis}
                      className="px-2.5 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors"
                    >
                      {savingDiagnosis ? 'Salvando...' : 'Salvar Diagnóstico'}
                    </button>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Descreva as análises realizadas, componentes com defeito identificados e solução técnica recomendada..."
                  disabled={isTerminal}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
                />
              </div>

              {/* Budget Section (Services and Parts) */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-teal-600" />
                      Orçamento de Peças e Serviços
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Status da aprovação: <strong className="text-slate-800 uppercase">{order.budget_status}</strong>
                      {order.budget_approved_at && ` em ${formatDateTime(order.budget_approved_at)} por ${order.budget_approved_by || 'Proprietário'}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {order.budget_status !== 'pendente' && canEditBudget && (
                      <button
                        type="button"
                        onClick={handleRequestBudgetRevision}
                        disabled={submittingRevision}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${submittingRevision ? 'animate-spin' : ''}`} />
                        {submittingRevision ? 'Reabrindo...' : 'Reabrir Orçamento'}
                      </button>
                    )}

                    {!isEditingBudget && canEditBudget && order.budget_status === 'pendente' && (
                      <button
                        type="button"
                        onClick={handleStartBudgetEdit}
                        className="px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 border border-teal-300 rounded-md transition-colors"
                      >
                        Editar Itens
                      </button>
                    )}
                  </div>
                </div>

                {isEditingBudget ? (
                  /* Budget Editing Form */
                  <div className="space-y-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {/* Services editor */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">Mão de Obra / Serviços</span>
                        <button
                          type="button"
                          onClick={handleAddEditService}
                          className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Serviço
                        </button>
                      </div>
                      {editServices.map((srv, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            required
                            placeholder="Descrição do serviço"
                            value={srv.description}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditServices(prev => {
                                const c = [...prev];
                                c[idx].description = v;
                                return c;
                              });
                            }}
                            className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">Qtd:</span>
                            <input
                              type="number"
                              min="1"
                              value={srv.quantity}
                              onChange={(e) => {
                                const v = parseInt(e.target.value, 10) || 1;
                                setEditServices(prev => {
                                  const c = [...prev];
                                  c[idx].quantity = v;
                                  return c;
                                });
                              }}
                              className="w-14 px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-mono tabular-nums"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-400">R$:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={(srv.unit_price_cents / 100).toFixed(2)}
                              onChange={(e) => {
                                const cents = Math.round(parseFloat(e.target.value || '0') * 100) || 0;
                                setEditServices(prev => {
                                  const c = [...prev];
                                  c[idx].unit_price_cents = cents;
                                  return c;
                                });
                              }}
                              className="w-24 px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono tabular-nums"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditService(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Parts editor */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700">Peças e Componentes</span>
                        <button
                          type="button"
                          onClick={handleAddEditPart}
                          className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Peça
                        </button>
                      </div>
                      {editParts.map((prt, idx) => (
                        <div key={idx} className="space-y-1.5 mb-2.5 p-2 bg-white rounded border border-slate-200">
                          <div className="flex items-center gap-2">
                            <select
                              value={prt.inventory_item_id || ''}
                              onChange={(e) => handleSelectInventoryForPart(idx, e.target.value)}
                              className="w-1/3 px-2 py-1.5 border border-slate-300 rounded text-xs text-slate-700"
                            >
                              <option value="">Peça Avulsa / Sem Vínculo</option>
                              {inventoryList.map(item => (
                                <option key={item.id} value={item.id}>
                                  {item.name} (Disp: {item.quantity})
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              required
                              placeholder="Descrição da peça"
                              value={prt.description}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditParts(prev => {
                                  const c = [...prev];
                                  c[idx].description = v;
                                  return c;
                                });
                              }}
                              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">Qtd:</span>
                              <input
                                type="number"
                                min="1"
                                value={prt.quantity}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10) || 1;
                                  setEditParts(prev => {
                                    const c = [...prev];
                                    c[idx].quantity = v;
                                    return c;
                                  });
                                }}
                                className="w-14 px-2 py-1.5 border border-slate-300 rounded text-xs text-center font-mono tabular-nums"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">R$:</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0,00"
                                value={(prt.unit_price_cents / 100).toFixed(2)}
                                onChange={(e) => {
                                  const cents = Math.round(parseFloat(e.target.value || '0') * 100) || 0;
                                  setEditParts(prev => {
                                    const c = [...prev];
                                    c[idx].unit_price_cents = cents;
                                    return c;
                                  });
                                }}
                                className="w-24 px-2 py-1.5 border border-slate-300 rounded text-xs text-right font-mono tabular-nums"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEditPart(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsEditingBudget(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBudget}
                        disabled={savingBudget}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded shadow-xs disabled:opacity-50"
                      >
                        {savingBudget ? 'Calculando e Salvando...' : 'Calcular e Salvar Orçamento'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Budget Display Table */
                  <div className="space-y-3">
                    {services.length === 0 && parts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Nenhum item orçado ainda.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 text-xs">
                        {services.map((s) => (
                          <div key={s.id} className="py-1.5 flex items-center justify-between">
                            <span className="text-slate-800">
                              {s.description} <span className="text-slate-400">(x{s.quantity})</span>
                            </span>
                            <span className="font-mono font-medium text-slate-900 tabular-nums">
                              {formatCurrency(s.total_cents)}
                            </span>
                          </div>
                        ))}
                        {parts.map((p) => (
                          <div key={p.id} className="py-1.5 flex items-center justify-between">
                            <span className="text-slate-800 flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-teal-600" />
                              {p.description} <span className="text-slate-400">(x{p.quantity})</span>
                              {p.inventory_debited === 1 && (
                                <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded font-medium">
                                  Baixa efetuada
                                </span>
                              )}
                            </span>
                            <span className="font-mono font-medium text-slate-900 tabular-nums">
                              {formatCurrency(p.total_cents)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Totals */}
                    <div className="pt-2 border-t border-slate-200 flex flex-col items-end text-xs">
                      <div className="text-slate-500">
                        Serviços: <span className="font-mono tabular-nums">{formatCurrency(order.total_services_cents)}</span>
                      </div>
                      <div className="text-slate-500">
                        Peças: <span className="font-mono tabular-nums">{formatCurrency(order.total_parts_cents)}</span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-1">
                        Valor Total Orçado: <span className="font-mono text-teal-700 tabular-nums">{formatCurrency(order.total_amount_cents)}</span>
                      </div>
                    </div>

                    {/* Approval Controls */}
                    {order.budget_status === 'pendente' && !isTerminal && (
                      <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <input
                          type="text"
                          placeholder="Observações da decisão (ex: cliente aprovou por WhatsApp)"
                          value={budgetDecisionNotes}
                          onChange={(e) => setBudgetDecisionNotes(e.target.value)}
                          className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBudgetDecision('recusado')}
                            disabled={submittingDecision}
                            className="px-3 py-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-colors disabled:opacity-50"
                          >
                            {submittingDecision ? 'Processando...' : 'Recusado pelo Cliente'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBudgetDecision('aprovado')}
                            disabled={submittingDecision}
                            className="px-3.5 py-1.5 rounded bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
                          >
                            {submittingDecision ? 'Aprovando...' : 'Aprovar Orçamento'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order History Timeline */}
              <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  Histórico e Auditoria da OS
                </h4>
                <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {history.map((h) => (
                    <div key={h.id} className="py-2 text-xs flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-slate-800">{h.description}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateTime(h.created_at)} · Por {h.user_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            {order ? `OS criada em ${formatDateTime(order.created_at)} · Versão: ${order.version}` : ''}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Cancellation Justification Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              Confirmar Cancelamento da OS
            </h3>
            <p className="text-xs text-slate-600">
              O cancelamento requer uma justificativa obrigatória para auditoria (ex: cliente desistiu, peça descontinuada, equipamento sem reparo).
            </p>
            {parts.some(p => p.inventory_debited === 1) && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-900 leading-relaxed">
                <strong>Atenção ao estoque:</strong> Esta OS já iniciou reparo e baixou peças do estoque. O cancelamento preserva o histórico de movimentações e não estorna o saldo automaticamente. Se a peça foi devolvida fisicamente à prateleira, faça um ajuste manual com justificativa no módulo de Estoque.
              </div>
            )}
            <textarea
              required
              rows={3}
              placeholder="Digite a justificativa detalhada do cancelamento..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                disabled={submittingCancellation}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md disabled:opacity-50"
              >
                {submittingCancellation ? 'Cancelando OS...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Confirmation Modal */}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Confirmar Entrega do Equipamento
            </h3>
            <p className="text-xs text-slate-600">
              Confirme a entrega do aparelho reparado ao cliente. O status passará para "Entregue".
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeliveryModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelivery}
                disabled={submittingDelivery}
                className="px-3.5 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md disabled:opacity-50"
              >
                {submittingDelivery ? 'Confirmando...' : 'Confirmar Entrega'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
