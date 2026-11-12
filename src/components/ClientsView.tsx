import { contactValidationError } from '../lib/validation';
import React, { useState, useEffect } from 'react';
import { apiRequest, formatDateTime, formatCurrency, statusLabel } from '../lib/api';
import { Client, Order } from '../types';
import {
  Search,
  UserPlus,
  Edit2,
  Archive,
  RotateCcw,
  Users,
  X,
  AlertCircle,
  Clock,
  Eye
} from 'lucide-react';

interface ClientsViewProps {
  onSelectOrder?: (orderId: string) => void;
  refreshTrigger?: number;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onSelectOrder, refreshTrigger }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modal create/edit state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Client Details & Orders Drawer
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const fetchClients = async () => {
    setLoadError(null);
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (includeArchived) params.append('includeArchived', 'true');

      const res = await apiRequest<{ clients: Client[] }>(`/api/clients?${params.toString()}`);
      setClients(res.clients || []);
    } catch (err: any) {
      setLoadError(err.message || 'Não foi possível carregar os dados.');
      console.error('Falha ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, includeArchived, refreshTrigger]);

  const handleOpenCreateModal = () => {
    setEditingClient(null);
    setName('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setDocument('');
    setAddress('');
    setNotes('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Client) => {
    setEditingClient(c);
    setName(c.name);
    setPhone(c.phone);
    setWhatsapp(c.whatsapp || '');
    setEmail(c.email || '');
    setDocument(c.document || '');
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim() || !phone.trim()) {
      setModalError('Nome e telefone do cliente são obrigatórios.');
      return;
    }

    const contactError = contactValidationError(phone, whatsapp, document);
    if (contactError) { setModalError(contactError); return; }

    try {
      setSubmitting(true);
      if (editingClient) {
        await apiRequest(`/api/clients/${editingClient.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim(),
            email: email.trim(),
            document: document.trim(),
            address: address.trim(),
            notes: notes.trim(),
          }),
        });
      } else {
        await apiRequest('/api/clients', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            whatsapp: whatsapp.trim(),
            email: email.trim(),
            document: document.trim(),
            address: address.trim(),
            notes: notes.trim(),
          }),
        });
      }

      if (editingClient && selectedClientForDetails?.id === editingClient.id) {
        setSelectedClientForDetails(prev => prev ? ({
          ...prev,
          name: name.trim(),
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || undefined,
          email: email.trim() || undefined,
          document: document.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
        }) : null);
      }

      setIsModalOpen(false);
      fetchClients();
    } catch (err: any) {
      setModalError(err.message || 'Falha ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (c: Client) => {
    const isArchiving = c.is_archived === 0;
    try {
      setLoadError(null);
      await apiRequest(`/api/clients/${c.id}/${isArchiving ? 'archive' : 'unarchive'}`, {
        method: 'POST',
      });
      fetchClients();
    } catch (err: any) {
      setLoadError(err.message || 'Falha ao atualizar status do cliente.');
    }
  };

  const handleViewClientOrders = async (c: Client) => {
    setSelectedClientForDetails(c);
    setLoadingDetails(true);
    setDrawerError(null);
    try {
      const res = await apiRequest<{ client: Client; orders: Order[] }>(`/api/clients/${c.id}`);
      setClientOrders(res.orders || []);
    } catch (e: any) {
      setDrawerError(e.message || 'Não foi possível carregar as ordens de serviço do cliente.');
      console.error('Falha ao obter ordens do cliente:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="space-y-5">
      {loadError && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{loadError} <button type="button" onClick={()=>fetchClients()} className="underline ml-2">Tentar novamente</button></div>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cadastro de Clientes</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Mantenha o cadastro atualizado para emissão de ordens de serviço e contato
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cadastrar Novo Cliente</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, WhatsApp, CPF/CNPJ ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer self-start sm:self-auto">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded text-teal-600 focus:ring-teal-500"
          />
          <span>Exibir clientes arquivados</span>
        </label>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loadError ? <p className="p-6 text-sm text-slate-500">Os dados não estão disponíveis. Tente carregar novamente.</p> : loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando lista de clientes...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search ? 'Nenhum cliente encontrado com este termo' : 'Nenhum cliente cadastrado ainda'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {search
                ? 'Tente pesquisar com outro nome, telefone ou número de documento.'
                : 'Cadastre seus clientes para vincular a ordens de serviço e histórico de aparelhos.'}
            </p>
            {!search && (
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Cadastrar Primeiro Cliente</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Telefone / WhatsApp</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Total de OS</th>
                  <th className="px-4 py-3">Cadastro</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 transition-colors ${c.is_archived === 1 ? 'opacity-60 bg-slate-50/50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono tabular-nums text-slate-800">{c.phone}</div>
                      {c.whatsapp && c.whatsapp !== c.phone && (
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">Zap: {c.whatsapp}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                      {c.document || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums font-medium text-slate-800">
                      {c.total_orders || 0}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatDateTime(c.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewClientOrders(c)}
                          title="Ver histórico de ordens deste cliente"
                          className="p-1.5 rounded text-slate-500 hover:text-teal-600 hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          title="Editar cadastro"
                          className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(c)}
                          title={c.is_archived === 1 ? 'Desarquivar cliente' : 'Arquivar cliente'}
                          className={`p-1.5 rounded transition-colors ${
                            c.is_archived === 1
                              ? 'text-teal-600 hover:bg-teal-50'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                          }`}
                        >
                          {c.is_archived === 1 ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingClient ? 'Editar Cadastro do Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-3.5">
              {modalError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do cliente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Telefone Principal *</label>
                  <input
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Comercial</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CPF ou CNPJ</label>
                  <input
                    type="text"
                    placeholder="Documento fiscal"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="cliente@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Rua, Número, Bairro, Cidade, CEP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações Internas</label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionais sobre o cliente..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Details and Orders History Drawer */}
      {selectedClientForDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedClientForDetails.name}</h3>
                <p className="text-xs text-slate-500">Histórico de Ordens de Serviço</p>
              </div>
              <button
                onClick={() => setSelectedClientForDetails(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p><strong>Telefone:</strong> <span className="font-mono tabular-nums">{selectedClientForDetails.phone}</span></p>
                {selectedClientForDetails.whatsapp && (
                  <p><strong>WhatsApp:</strong> <span className="font-mono tabular-nums">{selectedClientForDetails.whatsapp}</span></p>
                )}
                {selectedClientForDetails.document && (
                  <p><strong>CPF/CNPJ:</strong> <span className="font-mono tabular-nums">{selectedClientForDetails.document}</span></p>
                )}
                {selectedClientForDetails.address && (
                  <p><strong>Endereço:</strong> {selectedClientForDetails.address}</p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Ordens de Serviço deste Cliente
                </h4>
                {drawerError && (
                  <div role="alert" className="p-3 mb-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
                    <span>{drawerError}</span>
                    <button
                      type="button"
                      onClick={() => selectedClientForDetails && handleViewClientOrders(selectedClientForDetails)}
                      className="underline font-semibold ml-2 text-rose-800 hover:text-rose-950"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
                {loadingDetails ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Carregando ordens...</p>
                ) : clientOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center italic">Nenhuma OS aberta para este cliente até o momento.</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {clientOrders.map((ord) => (
                      <div key={ord.id} className="p-3 text-xs flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-bold text-slate-900 font-mono tabular-nums">
                            OS #{String(ord.order_number).padStart(4, '0')} · {ord.brand} {ord.model}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Status: {statusLabel(ord.status)} · {formatDateTime(ord.created_at)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrency(ord.total_amount_cents)}
                          </span>
                          {onSelectOrder && (
                            <button
                              onClick={() => {
                                setSelectedClientForDetails(null);
                                onSelectOrder(ord.id);
                              }}
                              className="px-2 py-1 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded"
                            >
                              Abrir OS
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedClientForDetails(null)}
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
