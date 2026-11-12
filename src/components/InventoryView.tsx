import React, { useState, useEffect } from 'react';
import { apiRequest, formatCurrency, formatDateTime } from '../lib/api';
import { InventoryItem, InventoryMovement } from '../types';
import {
  Package,
  PlusCircle,
  Search,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  History,
  X,
  AlertCircle
} from 'lucide-react';

interface InventoryViewProps {
  refreshTrigger?: number;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ refreshTrigger }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [summary, setSummary] = useState({
    totalItems: 0,
    lowStockCount: 0,
    totalCostValueCents: 0,
    totalSaleValueCents: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // New / Edit Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('geral');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [minQuantity, setMinQuantity] = useState('2');
  const [costPriceReal, setCostPriceReal] = useState('');
  const [salePriceReal, setSalePriceReal] = useState('');
  const [itemModalError, setItemModalError] = useState<string | null>(null);
  const [submittingItem, setSubmittingItem] = useState(false);

  // Movement Modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null);
  const [moveType, setMoveType] = useState<'entrada' | 'saida_manual'>('entrada');
  const [moveQuantity, setMoveQuantity] = useState('1');
  const [moveReason, setMoveReason] = useState('');
  const [moveModalError, setMoveModalError] = useState<string | null>(null);
  const [submittingMove, setSubmittingMove] = useState(false);

  // History Drawer
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchInventory = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (categoryFilter !== 'todos') params.append('category', categoryFilter);
      if (lowStockFilter) params.append('lowStock', 'true');

      const res = await apiRequest<{ items: InventoryItem[]; summary: any }>(`/api/inventory?${params.toString()}`);
      setItems(res.items || []);
      if (res.summary) setSummary(res.summary);
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível carregar os dados.');
      console.error('Falha ao listar estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInventory();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, categoryFilter, lowStockFilter, refreshTrigger]);

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setName('');
    setSku('');
    setCategory('geral');
    setInitialQuantity('0');
    setMinQuantity('2');
    setCostPriceReal('');
    setSalePriceReal('');
    setItemModalError(null);
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku);
    setCategory(item.category);
    setMinQuantity(String(item.min_quantity));
    setCostPriceReal((item.cost_price_cents / 100).toFixed(2));
    setSalePriceReal((item.sale_price_cents / 100).toFixed(2));
    setItemModalError(null);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemModalError(null);

    if (!name.trim()) {
      setItemModalError('O nome da peça é obrigatório.');
      return;
    }

    const costCents = Math.round(parseFloat(costPriceReal.replace(',', '.')) * 100) || 0;
    const saleCents = Math.round(parseFloat(salePriceReal.replace(',', '.')) * 100) || 0;

    try {
      setSubmittingItem(true);
      if (editingItem) {
        await apiRequest(`/api/inventory/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim(),
            category,
            minQuantity: parseInt(minQuantity, 10) || 1,
            costPriceCents: costCents,
            salePriceCents: saleCents
          })
        });
      } else {
        await apiRequest('/api/inventory', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            sku: sku.trim(),
            category,
            initialQuantity: parseInt(initialQuantity, 10) || 0,
            minQuantity: parseInt(minQuantity, 10) || 1,
            costPriceCents: costCents,
            salePriceCents: saleCents
          })
        });
      }

      setIsItemModalOpen(false);
      fetchInventory();
    } catch (err: any) {
      setItemModalError(err.message || 'Falha ao salvar peça.');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleOpenMovement = (item: InventoryItem) => {
    setMoveItem(item);
    setMoveType('entrada');
    setMoveQuantity('1');
    setMoveReason('');
    setMoveModalError(null);
    setIsMoveModalOpen(true);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveItem) return;
    setMoveModalError(null);

    const qty = parseInt(moveQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setMoveModalError('A quantidade deve ser um número maior que zero.');
      return;
    }

    if (!moveReason.trim()) {
      setMoveModalError('Informe a justificativa da movimentação.');
      return;
    }

    try {
      setSubmittingMove(true);
      await apiRequest(`/api/inventory/${moveItem.id}/movement`, {
        method: 'POST',
        body: JSON.stringify({
          type: moveType,
          quantity: qty,
          reason: moveReason.trim()
        })
      });

      setIsMoveModalOpen(false);
      fetchInventory();
    } catch (err: any) {
      setMoveModalError(err.message || 'Falha ao registrar movimentação.');
    } finally {
      setSubmittingMove(false);
    }
  };

  const handleOpenHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await apiRequest<{ movements: InventoryMovement[] }>(`/api/inventory/${item.id}`);
      setMovements(res.movements || []);
    } catch (e: any) {
      setMovements([]);
      setErrorMsg(e.message || 'Não foi possível carregar o histórico de estoque.');
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && <p role="alert" className="text-sm text-rose-700">{errorMsg}</p>}
      {loadError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{loadError} <button type="button" onClick={()=>fetchInventory()} className="underline ml-2">Tentar novamente</button></div>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Estoque de Peças e Componentes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controle de saldo com proteção contra saldo negativo e baixa automática em ordens de serviço
          </p>
        </div>

        <button
          onClick={handleOpenCreateItem}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Cadastrar Nova Peça</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total de Itens</span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {summary.totalItems}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Estoque Baixo</span>
          <div className={`mt-1 text-xl font-bold font-mono tabular-nums ${summary.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {summary.lowStockCount}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Valor em Custo</span>
          <div className="mt-1 text-xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCurrency(summary.totalCostValueCents)}
          </div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Potencial de Venda</span>
          <div className="mt-1 text-xl font-bold text-teal-700 font-mono tabular-nums">
            {formatCurrency(summary.totalSaleValueCents)}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar peça por nome ou código SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:ring-1 focus:ring-teal-500"
          >
            <option value="todos">Todas categorias</option>
            <option value="telas">Telas / Displays</option>
            <option value="baterias">Baterias</option>
            <option value="conectores">Conectores / Flex</option>
            <option value="placas">Placas / CIs</option>
            <option value="acessorios">Acessórios / Cabos</option>
            <option value="geral">Geral / Outros</option>
          </select>

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => setLowStockFilter(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Apenas estoque baixo</span>
          </label>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loadError ? <p className="p-6 text-sm text-slate-500">Os dados não estão disponíveis. Tente carregar novamente.</p> : loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando itens de estoque...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search || categoryFilter !== 'todos' ? 'Nenhuma peça encontrada com estes filtros' : 'Nenhuma peça cadastrada no estoque'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              O estoque inicia zerado. Cadastre telas, baterias e componentes para controle de saldo e inserção rápida nas ordens.
            </p>
            {!search && categoryFilter === 'todos' && (
              <button
                onClick={handleOpenCreateItem}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Cadastrar Primeira Peça</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nome da Peça</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-center">Saldo Atual</th>
                  <th className="px-4 py-3 text-center">Mínimo</th>
                  <th className="px-4 py-3 text-right">Preço Custo</th>
                  <th className="px-4 py-3 text-right">Preço Venda</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => {
                  const isLow = it.quantity <= it.min_quantity;
                  return (
                    <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {it.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {it.sku || '-'}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">
                        {it.category}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs tabular-nums ${
                            it.quantity === 0
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {it.quantity} un
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500 tabular-nums">
                        {it.min_quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                        {formatCurrency(it.cost_price_cents)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(it.sale_price_cents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenMovement(it)}
                            title="Lançar entrada ou saída manual"
                            className="p-1.5 rounded text-slate-600 hover:text-teal-700 hover:bg-slate-100 transition-colors"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenHistory(it)}
                            title="Histórico de movimentações"
                            className="p-1.5 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditItem(it)}
                            title="Editar dados da peça"
                            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New / Edit Item Modal */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItem ? 'Editar Peça / Componente' : 'Cadastrar Nova Peça no Estoque'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-3.5">
              {itemModalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{itemModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Peça *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tela iPhone 13 Original, Bateria Galaxy S21"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Código / SKU</label>
                  <input
                    type="text"
                    placeholder="Código interno"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="geral">Geral</option>
                    <option value="telas">Telas / Displays</option>
                    <option value="baterias">Baterias</option>
                    <option value="conectores">Conectores / Flex</option>
                    <option value="placas">Placas / CIs</option>
                    <option value="acessorios">Acessórios</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {!editingItem && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Saldo Inicial (Qtd)</label>
                    <input
                      type="number"
                      min="0"
                      value={initialQuantity}
                      onChange={(e) => setInitialQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono tabular-nums focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                )}
                <div className={editingItem ? 'col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estoque Mínimo (Alerta)</label>
                  <input
                    type="number"
                    min="0"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono tabular-nums focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preço de Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={costPriceReal}
                    onChange={(e) => setCostPriceReal(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono tabular-nums focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preço de Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={salePriceReal}
                    onChange={(e) => setSalePriceReal(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono tabular-nums focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {parseFloat(salePriceReal) < parseFloat(costPriceReal) && <p className="text-xs text-amber-700">Atenção: o preço de venda está abaixo do custo.</p>}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingItem}
                  className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md shadow-xs disabled:opacity-50"
                >
                  {submittingItem ? 'Salvando...' : 'Salvar Peça'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Movement Modal */}
      {isMoveModalOpen && moveItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Movimentar Estoque Manualmente</h3>
                <p className="text-xs text-slate-500">{moveItem.name} (Saldo atual: {moveItem.quantity})</p>
              </div>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMovement} className="p-6 space-y-3.5">
              {moveModalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{moveModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Movimento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMoveType('entrada')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors ${
                      moveType === 'entrada'
                        ? 'bg-teal-50 border-teal-500 text-teal-800'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Entrada (Reposição/Compra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoveType('saida_manual')}
                    className={`py-2 text-xs font-semibold rounded-lg border text-center transition-colors ${
                      moveType === 'saida_manual'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Saída (Perda/Avaria/Ajuste)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantidade a Movimentar *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={moveQuantity}
                  onChange={(e) => setMoveQuantity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono tabular-nums focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Justificativa / Motivo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compra de lote do fornecedor X, peça com defeito de fábrica..."
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingMove}
                  className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md shadow-xs disabled:opacity-50"
                >
                  {submittingMove ? 'Lançando...' : 'Confirmar Movimentação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement History Drawer */}
      {historyItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Histórico de Movimentações</h3>
                <p className="text-xs text-slate-500">{historyItem.name} · Saldo Atual: {historyItem.quantity} un</p>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {loadingHistory ? (
                <p className="text-xs text-slate-400 text-center py-6">Carregando movimentações...</p>
              ) : movements.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6 italic">Nenhuma movimentação registrada.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
                  {movements.map((m) => (
                    <div key={m.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{m.reason}</div>
                        <div className="text-[11px] text-slate-400">
                          {formatDateTime(m.created_at)} · Por {m.user_name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono font-bold tabular-nums ${
                            m.type.includes('entrada') ? 'text-teal-700' : 'text-rose-600'
                          }`}
                        >
                          {m.type.includes('entrada') ? '+' : '-'}{m.quantity} un
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {m.previous_quantity} &rarr; {m.new_quantity} un
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
