import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { contactValidationError } from '../lib/validation';
import {
  Building2,
  Save,
  CheckCircle,
  AlertCircle,
  FileCheck,
  Image as ImageIcon,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { company, updateCompany, updateCompanyLogo } = useAuth();

  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [warrantyTerms, setWarrantyTerms] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Logo state & auto-save feedback
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoSaved, setLogoSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setDocument(company.document || '');
      setPhone(company.phone || '');
      setWhatsapp(company.whatsapp || '');
      setEmail(company.email || '');
      setAddress(company.address || '');
      setWarrantyTerms(company.warranty_terms || '');
      setReceiptNotes(company.receipt_notes || '');
    }
  }, [company?.id, company?.name, company?.document, company?.phone, company?.whatsapp, company?.email, company?.address, company?.warranty_terms, company?.receipt_notes]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so selecting the same file again triggers change
    if (e.target) e.target.value = '';
    if (!file) return;

    setLogoError(null);
    setLogoSaved(false);

    // 1. Validar formato MIME: aceita JPEG, PNG e WebP; rejeita explicitamente SVG e outros
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.type === 'image/svg+xml' || !validMimes.includes(file.type)) {
      setLogoError('Formato inválido. Por favor envie uma imagem em formato JPEG, PNG ou WebP. Arquivos SVG não são permitidos.');
      return;
    }

    // 2. Limite máximo de arquivo de entrada: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('O arquivo selecionado excede o limite máximo de 5MB. Escolha uma imagem menor.');
      return;
    }

    setLogoSaving(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxDim = 512;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = window.document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Não foi possível inicializar o processador gráfico da imagem.'));
              return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Compressão WebP prioritária com fallback para JPEG
            let output = canvas.toDataURL('image/webp', 0.85);
            if (!output.startsWith('data:image/webp')) {
              output = canvas.toDataURL('image/jpeg', 0.85);
            }

            // Se exceder 300KB (307.200 bytes), tenta compactação adicional
            if (output.length > 307200) {
              output = canvas.toDataURL('image/webp', 0.65);
              if (!output.startsWith('data:image/webp')) {
                output = canvas.toDataURL('image/jpeg', 0.65);
              }
            }

            if (output.length > 307200) {
              reject(new Error('A imagem compactada ainda excede 300KB. Tente uma imagem com menor resolução.'));
              return;
            }

            resolve(output);
          };
          img.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem selecionado.'));
          img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error('Falha ao carregar o arquivo no navegador.'));
        reader.readAsDataURL(file);
      });

      // Auto-save imediato no banco de dados em nuvem via RPC dedicada tf_update_company_logo
      await updateCompanyLogo(dataUrl);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 4000);
    } catch (err: any) {
      setLogoError('Não foi possível salvar a foto. Escolha uma imagem válida e tente novamente. A foto anterior foi mantida.');
    } finally {
      setLogoSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError(null);
    setLogoSaved(false);
    setLogoSaving(true);
    try {
      await updateCompanyLogo(null);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 3000);
    } catch (err: any) {
      setLogoError('Não foi possível remover a foto. Tente novamente.');
    } finally {
      setLogoSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('O nome da empresa é obrigatório.');
      return;
    }

    const contactError = contactValidationError(phone, whatsapp, document, false);
    if (contactError) {
      setErrorMsg(contactError);
      return;
    }

    try {
      setSubmitting(true);
      await updateCompany({
        name: name.trim(),
        document: document.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
        warranty_terms: warrantyTerms.trim(),
        receipt_notes: receiptNotes.trim(),
      });
      setSuccessMsg('Configurações da empresa salvas com sucesso.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao salvar configurações.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Configurações da Assistência Técnica</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Identidade visual, dados da empresa exibidos nas ordens de serviço e termos operacionais
        </p>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs flex items-start gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Identidade Visual / Logotipo da Empresa (com Auto-Save isolado) */}
      <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-teal-600" />
            Identidade da Empresa
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Foto ou logotipo da sua assistência técnica, exibido no cabeçalho do sistema, menu lateral e comprovantes impressos.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-1">
          {/* Avatar / Prévia / Placeholder discreto vazio */}
          <div className="relative shrink-0">
            {company?.company_logo_data_url ? (
              <div className="w-24 h-24 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center p-1 shadow-xs">
                <img
                  src={company.company_logo_data_url}
                  alt={company.name || 'Logotipo da empresa'}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 select-none"
                aria-label="Nenhum logotipo configurado"
              >
                <ImageIcon className="w-8 h-8 stroke-1 text-slate-300 mb-1" />
                <span className="text-[10px] font-medium text-slate-400">Sem foto</span>
              </div>
            )}
          </div>

          {/* Controles de Ação e Feedback */}
          <div className="space-y-2 flex-1">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Selecionar imagem do logotipo"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoSaving}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {logoSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>
                  {company?.company_logo_data_url ? 'Alterar foto' : 'Escolher foto'}
                </span>
              </button>

              {company?.company_logo_data_url && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={logoSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover</span>
                </button>
              )}

              {logoSaving && (
                <span className="inline-flex items-center gap-1.5 text-xs text-teal-700 font-medium ml-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  Salvando foto...
                </span>
              )}

              {logoSaved && !logoSaving && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium ml-1 animate-fade-in">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Foto salva
                </span>
              )}
            </div>

            {logoError && (
              <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {logoError}
              </p>
            )}

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Formatos aceitos: JPEG, PNG ou WebP até 5MB. A imagem é salva automaticamente e otimizada com resolução máxima de 512x512 pixels.
            </p>
          </div>
        </div>
      </section>

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação Cadastral */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Building2 className="w-4 h-4 text-teal-600" />
            Dados Cadastrais da Empresa
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-company-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Razão Social ou Nome Fantasia *
              </label>
              <input
                id="settings-company-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da assistência técnica"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label htmlFor="settings-company-document" className="block text-xs font-semibold text-slate-700 mb-1">
                CNPJ ou CPF
              </label>
              <input
                id="settings-company-document"
                type="text"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Documento fiscal para impressão"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="settings-company-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Telefone de Atendimento
              </label>
              <input
                id="settings-company-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefone fixo ou celular"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500 font-mono"
              />
            </div>
            <div>
              <label htmlFor="settings-company-whatsapp" className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Comercial
              </label>
              <input
                id="settings-company-whatsapp"
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Número do WhatsApp comercial"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500 font-mono"
              />
            </div>
            <div>
              <label htmlFor="settings-company-email" className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Contato
              </label>
              <input
                id="settings-company-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail da assistência técnica"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-company-address" className="block text-xs font-semibold text-slate-700 mb-1">
              Endereço Completo
            </label>
            <input
              id="settings-company-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade e CEP"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Termos de Garantia e Condições de Atendimento */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <FileCheck className="w-4 h-4 text-teal-600" />
            Termos Operacionais para Impressão da OS
          </h2>

          <div>
            <label htmlFor="settings-warranty-terms" className="block text-xs font-semibold text-slate-700 mb-1">
              Termos de Garantia (Opcional - impresso na Ordem de Serviço)
            </label>
            <textarea
              id="settings-warranty-terms"
              rows={3}
              value={warrantyTerms}
              onChange={(e) => setWarrantyTerms(e.target.value)}
              placeholder="Insira os termos de garantia definidos pela sua assistência técnica..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label htmlFor="settings-receipt-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Condições de Retirada (Opcional - impresso no comprovante)
            </label>
            <textarea
              id="settings-receipt-notes"
              rows={2}
              value={receiptNotes}
              onChange={(e) => setReceiptNotes(e.target.value)}
              placeholder="Instruções sobre prazos e retirada do equipamento..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
