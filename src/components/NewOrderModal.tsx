import { contactValidationError, sanitizeAccessories, sanitizeConditions } from '../lib/validation';
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Client, DeviceType, OrderPriority } from '../types';
import { X, Plus, AlertCircle } from 'lucide-react';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Quick Client creation state
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientWhatsapp, setNewClientWhatsapp] = useState('');
  const [newClientDoc, setNewClientDoc] = useState('');

  // Device & Order fields
  const [deviceType, setDeviceType] = useState<DeviceType>('smartphone');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialImei, setSerialImei] = useState('');
  const [defectReported, setDefectReported] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('normal');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // Accessories Checklist
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [otherAccessories, setOtherAccessories] = useState('');

  // Entry Condition Checklist
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customConditionNotes, setCustomConditionNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const accessoryOptions = [
    'Carregador / Fonte',
    'Cabo USB',
    'Capa de proteção',
    'Película aplicada',
    'Bolsa / Mochila',
    'Cartão SIM / Chip',
    'Nenhum acessório',
  ];

  const conditionOptions = [
    'Liga normalmente',
    'Não liga / Sem sinal',
    'Tela com riscos superficiais',
    'Vidro frontal trincado',
    'Aro / Carcaça com marcas de queda',
    'Gabinete / Carcaça empenada',
    'Tampa traseira danificada',
    'Bateria com sinais de estufamento',
    'Sinais de contato com líquidos / oxidação',
    'Parafusos faltando ou violados',
  ];

  useEffect(() => {
    if (isOpen) {
      loadClients();
      setErrorMsg(null);
    }
  }, [isOpen]);

  const loadClients = async () => {
    try {
      const res = await apiRequest<{ clients: Client[] }>('/api/clients');
      setClients(res.clients || []);
      if (res.clients && res.clients.length > 0 && !selectedClientId) {
        setSelectedClientId(res.clients[0].id);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Não foi possível carregar os clientes.');
    }
  };

  const handleQuickCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newClientPhone.trim()) {
      setErrorMsg('Nome e telefone do cliente são obrigatórios.');
      return;
    }

    try {
      const contactError = contactValidationError(newClientPhone, newClientWhatsapp, newClientDoc);
      if (contactError) { setErrorMsg(contactError); return; }
      setSubmitting(true);
      const res = await apiRequest<{ client: Client }>('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          whatsapp: newClientWhatsapp.trim() || newClientPhone.trim(),
          document: newClientDoc.trim(),
        }),
      });
      setClients((prev) => [res.client, ...prev]);
      setSelectedClientId(res.client.id);
      setIsCreatingClient(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientWhatsapp('');
      setNewClientDoc('');
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao cadastrar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAccessory = (acc: string) => {
    if (acc === 'Nenhum acessório') setOtherAccessories('');
    setSelectedAccessories(prev => {
      if (prev.includes(acc)) return prev.filter(a => a !== acc);
      if (acc === 'Nenhum acessório') return [acc];
      return [...prev.filter(a => a !== 'Nenhum acessório'), acc];
    });
  };
  const toggleCondition = (cond: string) => {
    setSelectedConditions(prev => {
      if (prev.includes(cond)) return prev.filter(c => c !== cond);
      const opposite = cond === 'Liga normalmente' ? 'Não liga / Sem sinal' : cond === 'Não liga / Sem sinal' ? 'Liga normalmente' : null;
      return [...prev.filter(c => c !== opposite), cond];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedClientId) {
      setErrorMsg('Selecione um cliente para abrir a ordem de serviço.');
      return;
    }

    if (!brand.trim() || !model.trim()) {
      setErrorMsg('Informe a marca e o modelo do aparelho.');
      return;
    }

    if (!defectReported.trim()) {
      setErrorMsg('Descreva o defeito relatado pelo cliente.');
      return;
    }

    const accessories = sanitizeAccessories(selectedAccessories, otherAccessories);
    const conditions = sanitizeConditions(selectedConditions, customConditionNotes);
    if (!accessories.valid || !conditions.valid) { setErrorMsg(accessories.error || conditions.error || 'Confira os dados do aparelho.'); return; }
    const accessoriesString = accessories.result;
    const conditionString = conditions.result;

    try {
      setSubmitting(true);
      const res = await apiRequest<{ order: { id: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          clientId: selectedClientId,
          deviceType,
          brand: brand.trim(),
          model: model.trim(),
          serialImei: serialImei.trim(),
          defectReported: defectReported.trim(),
          accessories: accessoriesString,
          entryCondition: conditionString,
          priority,
          estimatedDelivery,
        }),
      });

      onSuccess(res.order.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar ordem de serviço.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Nova Ordem de Serviço</h2>
            <p className="text-xs text-slate-500">Recepção e triagem do equipamento</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Client Selection Section */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Cliente Solicitante *
              </label>
              {!isCreatingClient && (
                <button
                  type="button"
                  onClick={() => setIsCreatingClient(true)}
                  className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cadastrar Novo Cliente
                </button>
              )}
            </div>

            {isCreatingClient ? (
              <div className="p-3 bg-white border border-teal-200 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-teal-800">Cadastro Rápido de Cliente</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do cliente"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Telefone principal"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="tel"
                    placeholder="WhatsApp (opcional)"
                    value={newClientWhatsapp}
                    onChange={(e) => setNewClientWhatsapp(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="text"
                    placeholder="CPF ou CNPJ (opcional)"
                    value={newClientDoc}
                    onChange={(e) => setNewClientDoc(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingClient(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickCreateClient}
                    disabled={submitting}
                    className="px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md"
                  >
                    Salvar e Selecionar Cliente
                  </button>
                </div>
              </div>
            ) : clients.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                Nenhum cliente cadastrado ainda. Clique em "Cadastrar Novo Cliente" acima para adicionar.
              </div>
            ) : (
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {c.phone} {c.document ? `(${c.document})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Device Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Identificação do Equipamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="modal-device-type" className="block text-xs text-slate-600 mb-1">Tipo de Aparelho</label>
                <select
                  id="modal-device-type"
                  value={deviceType}
                  onChange={(e) => setDeviceType(e.target.value as DeviceType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="smartphone">Smartphone</option>
                  <option value="notebook">Notebook</option>
                  <option value="computador">Computador / Desktop</option>
                  <option value="tablet">Tablet</option>
                  <option value="smartwatch">Smartwatch</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label htmlFor="modal-device-brand" className="block text-xs text-slate-600 mb-1">Marca *</label>
                <input
                  id="modal-device-brand"
                  type="text"
                  required
                  placeholder="Ex: Apple, Samsung, Dell, Lenovo"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label htmlFor="modal-device-model" className="block text-xs text-slate-600 mb-1">Modelo *</label>
                <input
                  id="modal-device-model"
                  type="text"
                  required
                  placeholder="Ex: iPhone 13 Pro, Inspiron 15"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="modal-device-serial" className="block text-xs text-slate-600 mb-1">Nº de Série / IMEI</label>
                <input
                  id="modal-device-serial"
                  type="text"
                  placeholder="Opcional para identificação"
                  value={serialImei}
                  onChange={(e) => setSerialImei(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500 font-mono"
                />
              </div>
              <div>
                <label htmlFor="modal-order-priority" className="block text-xs text-slate-600 mb-1">Prioridade</label>
                <select
                  id="modal-order-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as OrderPriority)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label htmlFor="modal-estimated-delivery" className="block text-xs text-slate-600 mb-1">Previsão de Entrega</label>
                <input
                  id="modal-estimated-delivery"
                  type="date"
                  value={estimatedDelivery}
                  onChange={(e) => setEstimatedDelivery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {/* Defect Reported */}
          <div>
            <label htmlFor="modal-defect-reported" className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
              Defeito Relatado pelo Cliente *
            </label>
            <textarea
              id="modal-defect-reported"
              required
              rows={2}
              placeholder="Descreva o que o cliente relatou (ex: aparelho não carrega, tela apagada após queda, travando na inicialização)..."
              value={defectReported}
              onChange={(e) => setDefectReported(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Entry Condition Checklist */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Condição Física de Entrada (Checklist de Vistoria)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {conditionOptions.map((cond) => (
                <label
                  key={cond}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedConditions.includes(cond)
                      ? 'bg-teal-50/60 border-teal-300 text-teal-900 font-medium'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedConditions.includes(cond)}
                    onChange={() => toggleCondition(cond)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>{cond}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              placeholder="Outras observações sobre o estado do aparelho..."
              value={customConditionNotes}
              onChange={(e) => setCustomConditionNotes(e.target.value)}
              className="w-full mt-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Accessories Left */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Acessórios Deixados na Recepção
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {accessoryOptions.map((acc) => (
                <label
                  key={acc}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedAccessories.includes(acc)
                      ? 'bg-teal-50/60 border-teal-300 text-teal-900 font-medium'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccessories.includes(acc)}
                    onChange={() => toggleAccessory(acc)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>{acc}</span>
                </label>
              ))}
            </div>
            <input
              type="text"
              placeholder="Outro acessório (ex: adaptador de cartão, fone)..."
              value={otherAccessories}
              onChange={(e) => { setOtherAccessories(e.target.value); if (e.target.value.trim()) setSelectedAccessories(prev => prev.filter(a => a !== 'Nenhum acessório')); }}
              className="w-full mt-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting ? 'Registrando...' : 'Emitir Ordem de Serviço'}
          </button>
        </div>
      </div>
    </div>
  );
};
