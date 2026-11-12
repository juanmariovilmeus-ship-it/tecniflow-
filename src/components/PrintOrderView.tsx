import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Order, OrderServiceItem, OrderPartItem } from '../types';
import { formatCurrency, formatDateTime, deviceTypeLabel, statusLabel } from '../lib/api';
import { Printer, ArrowLeft } from 'lucide-react';

interface PrintOrderViewProps {
  order: Order;
  services: OrderServiceItem[];
  parts: OrderPartItem[];
  onBack: () => void;
}

export const PrintOrderView: React.FC<PrintOrderViewProps> = ({
  order,
  services,
  parts,
  onBack,
}) => {
  const { company } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  const hasWarrantyTerms = Boolean(company?.warranty_terms && company.warranty_terms.trim());
  const hasReceiptNotes = Boolean(company?.receipt_notes && company.receipt_notes.trim());

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-slate-900">
      {/* Top action bar - Hidden when printing */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between no-print">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao Sistema</span>
        </button>

        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span>Imprimir / Salvar PDF</span>
        </button>
      </div>

      {/* A4 Printable Sheet */}
      <div className="printable-document max-w-4xl mx-auto bg-white p-8 sm:p-10 border border-slate-200 shadow-lg print:border-none print:shadow-none print:p-0 text-slate-900 text-xs space-y-6">
        {/* Company Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-start gap-3.5">
            {company?.company_logo_data_url && (
              <img
                src={company.company_logo_data_url}
                alt={company.name || 'Logotipo da assistência'}
                className="w-14 h-14 object-contain rounded border border-slate-200 p-0.5 shrink-0"
              />
            )}
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900">
                {company?.name || 'Assistência Técnica'}
              </h1>
              {company?.document && <p className="text-slate-600">CNPJ / CPF: {company.document}</p>}
              {company?.address && <p className="text-slate-600">{company.address}</p>}
              <p className="text-slate-600">
                {company?.phone && `Tel: ${company.phone}`}
                {company?.whatsapp && ` · WhatsApp: ${company.whatsapp}`}
                {company?.email && ` · E-mail: ${company.email}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ordem de Serviço
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              #{String(order.order_number).padStart(4, '0')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Entrada: {formatDateTime(order.created_at)}
            </div>
            <div className="text-[11px] font-semibold text-slate-700">
              Status: {statusLabel(order.status).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
              Dados do Cliente
            </h3>
            <p className="font-bold text-sm text-slate-900">{order.client_name}</p>
            <p className="text-slate-700">Telefone: <span className="font-mono tabular-nums">{order.client_phone}</span></p>
            {order.client_whatsapp && (
              <p className="text-slate-700">WhatsApp: <span className="font-mono tabular-nums">{order.client_whatsapp}</span></p>
            )}
            {order.client_document && (
              <p className="text-slate-700">Documento: <span className="font-mono tabular-nums">{order.client_document}</span></p>
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
              Endereço / Contato
            </h3>
            <p className="text-slate-700">{order.client_address || 'Endereço não informado'}</p>
            {order.client_email && <p className="text-slate-700">E-mail: {order.client_email}</p>}
          </div>
        </div>

        {/* Equipment & Inspection */}
        <div className="border border-slate-300 rounded p-3 space-y-2">
          <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200 pb-1">
            Equipamento & Triagem de Entrada
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-slate-500">Tipo: </span>
              <strong className="text-slate-800">{deviceTypeLabel(order.device_type)}</strong>
            </div>
            <div>
              <span className="text-slate-500">Marca/Modelo: </span>
              <strong className="text-slate-800">{order.brand} {order.model}</strong>
            </div>
            <div>
              <span className="text-slate-500">IMEI / Nº Série: </span>
              <span className="font-mono text-slate-800">{order.serial_imei || 'Não informado'}</span>
            </div>
          </div>

          <div className="pt-1">
            <span className="font-bold text-slate-700">Defeito Relatado: </span>
            <span className="text-slate-800">{order.defect_reported}</span>
          </div>

          {order.entry_condition && (
            <div>
              <span className="font-bold text-slate-700">Condições de Entrada / Vistoria: </span>
              <span className="text-slate-800">{order.entry_condition}</span>
            </div>
          )}

          {order.accessories && (
            <div>
              <span className="font-bold text-slate-700">Acessórios Deixados: </span>
              <span className="text-slate-800">{order.accessories}</span>
            </div>
          )}

          {order.technical_diagnosis && (
            <div className="pt-1 border-t border-slate-200">
              <span className="font-bold text-slate-700">Diagnóstico Técnico: </span>
              <span className="text-slate-800">{order.technical_diagnosis}</span>
            </div>
          )}
        </div>

        {/* Itemized Budget Table */}
        <div className="space-y-2">
          <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            Discriminação do Orçamento (Serviços e Peças)
          </h3>
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="p-2 border border-slate-300">Tipo</th>
                <th className="p-2 border border-slate-300">Descrição do Item</th>
                <th className="p-2 border border-slate-300 text-center w-16">Qtd</th>
                <th className="p-2 border border-slate-300 text-right w-24">Unitário</th>
                <th className="p-2 border border-slate-300 text-right w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 && parts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400 italic border border-slate-300">
                    Nenhum serviço ou peça orçada registrado.
                  </td>
                </tr>
              ) : (
                <>
                  {services.map((s) => (
                    <tr key={s.id} className="border border-slate-300">
                      <td className="p-2 text-slate-600 font-medium">Serviço</td>
                      <td className="p-2 font-medium text-slate-800">{s.description}</td>
                      <td className="p-2 text-center font-mono tabular-nums">{s.quantity}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{formatCurrency(s.unit_price_cents)}</td>
                      <td className="p-2 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(s.total_cents)}
                      </td>
                    </tr>
                  ))}
                  {parts.map((p) => (
                    <tr key={p.id} className="border border-slate-300">
                      <td className="p-2 text-slate-600 font-medium">Peça</td>
                      <td className="p-2 font-medium text-slate-800">{p.description}</td>
                      <td className="p-2 text-center font-mono tabular-nums">{p.quantity}</td>
                      <td className="p-2 text-right font-mono tabular-nums">{formatCurrency(p.unit_price_cents)}</td>
                      <td className="p-2 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatCurrency(p.total_cents)}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="p-2 text-right border border-slate-300">Subtotal Serviços:</td>
                <td className="p-2 text-right border border-slate-300 font-mono tabular-nums">
                  {formatCurrency(order.total_services_cents)}
                </td>
              </tr>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="p-2 text-right border border-slate-300">Subtotal Peças:</td>
                <td className="p-2 text-right border border-slate-300 font-mono tabular-nums">
                  {formatCurrency(order.total_parts_cents)}
                </td>
              </tr>
              <tr className="bg-slate-100 font-bold text-sm">
                <td colSpan={4} className="p-2 text-right border border-slate-300">VALOR TOTAL DA OS:</td>
                <td className="p-2 text-right border border-slate-300 font-mono text-slate-900 tabular-nums">
                  {formatCurrency(order.total_amount_cents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Warranty Terms and Notes (Only rendered if filled by shop owner) */}
        {(hasWarrantyTerms || hasReceiptNotes) && (
          <div className="border border-slate-300 rounded p-3 space-y-1 text-[11px] text-slate-600 bg-slate-50/50 print-card">
            {hasWarrantyTerms && (
              <div>
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Termos de Garantia
                </div>
                <p>{company?.warranty_terms}</p>
              </div>
            )}
            {hasReceiptNotes && (
              <div className="pt-1">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Observações de Retirada
                </div>
                <p>{company?.receipt_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 pt-8 print-card">
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1 text-slate-800 font-medium">
              {order.client_name}
            </div>
            <div className="text-[10px] text-slate-500">Assinatura do Cliente / Solicitante</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 pt-1 text-slate-800 font-medium">
              {company?.name || 'Técnico Responsável'}
            </div>
            <div className="text-[10px] text-slate-500">Assinatura da Assistência Técnica</div>
          </div>
        </div>
      </div>
    </div>
  );
};
