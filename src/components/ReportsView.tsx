import React, { useState, useEffect } from 'react';
import { apiRequest, formatCurrency, statusLabel, deviceTypeLabel } from '../lib/api';
import { PeriodReportSummary } from '../types';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  FileText,
  Clock,
  Layers,
  Wrench,
  Package,
  AlertCircle
} from 'lucide-react';

const getLocalDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ReportsView: React.FC = () => {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startDate, setStartDate] = useState(getLocalDateString(firstDay));
  const [endDate, setEndDate] = useState(getLocalDateString(today));
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [summary, setSummary] = useState<PeriodReportSummary>({
    totalOrders: 0,
    totalBudgetedCents: 0,
    totalDeliveredCents: 0,
    deliveredCount: 0,
    cancelledCount: 0,
    avgHoursTurnaround: 0
  });

  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ status: string; count: number; amount_cents: number }>>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<Array<{ device_type: any; count: number }>>([]);
  const [topServices, setTopServices] = useState<Array<{ description: string; frequency: number; total_qty: number; total_cents: number }>>([]);
  const [topParts, setTopParts] = useState<Array<{ description: string; frequency: number; total_qty: number; total_cents: number }>>([]);

  const fetchReport = async () => {
    if (startDate && endDate && startDate > endDate) {
      setErrorMsg('A data inicial não pode ser superior à data final.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest<{
        summary: PeriodReportSummary;
        statusBreakdown: any[];
        deviceBreakdown: any[];
        topServices: any[];
        topParts: any[];
      }>(`/api/reports/period?${params.toString()}`);

      setSummary(res.summary);
      setStatusBreakdown(res.statusBreakdown || []);
      setDeviceBreakdown(res.deviceBreakdown || []);
      setTopServices(res.topServices || []);
      setTopParts(res.topParts || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Top Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Relatórios de Atendimento</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Métricas por período: ordens abertas no período (por data de entrada) e serviços entregues (por data de conclusão)
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-slate-200 shadow-xs self-start sm:self-auto text-xs">
          <Calendar className="w-4 h-4 text-slate-400 ml-1.5" />
          <input
            id="report-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded text-slate-700 font-mono text-xs"
          />
          <span className="text-slate-400">até</span>
          <input
            id="report-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded text-slate-700 font-mono text-xs"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-sm text-slate-400">Calculando métricas do período...</div>
      ) : (
        <>
          {/* Main 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Serviços Entregues no Período */}
            <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-xs bg-gradient-to-b from-teal-50/20 to-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wider">Serviços Entregues</span>
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-teal-700 tabular-nums">
                {formatCurrency(summary.totalDeliveredCents)}
              </div>
              <p className="text-[11px] text-teal-900/70 mt-1">
                {summary.deliveredCount} OS concluídas/entregues no período
              </p>
            </div>

            {/* 2. Total Orçado (Propostas emitidas nas ordens abertas) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Orçado</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-700 tabular-nums">
                {formatCurrency(summary.totalBudgetedCents)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Em {summary.totalOrders} ordens abertas no período
              </p>
            </div>

            {/* 3. Ordens Abertas no Período */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Novas Ordens</span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.totalOrders}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {summary.cancelledCount} cancelada(s) no período
              </p>
            </div>

            {/* 4. Tempo Médio */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tempo Médio Reparo</span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {summary.deliveredCount > 0 && summary.avgHoursTurnaround !== null ? `${summary.avgHoursTurnaround}h` : 'Sem dados'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {summary.deliveredCount > 0 ? 'Média entre entrada e entrega final' : 'Nenhuma OS entregue no período'}
              </p>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Status Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                Distribuição de Status (Ordens Abertas no Período)
              </h3>
              {statusBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">Nenhuma ordem registrada no período selecionado.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {statusBreakdown.map((sb) => (
                    <div key={sb.status} className="py-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{statusLabel(sb.status as any)}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-slate-500 tabular-nums">{sb.count} OS</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums w-24 text-right">
                          {formatCurrency(sb.amount_cents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-teal-600" />
                Aparelhos Atendidos por Tipo
              </h3>
              {deviceBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">Nenhum equipamento registrado no período selecionado.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {deviceBreakdown.map((db) => (
                    <div key={db.device_type} className="py-2 flex items-center justify-between">
                      <span className="font-medium text-slate-800">{deviceTypeLabel(db.device_type)}</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">{db.count} aparelho(s)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ranking of Services and Parts (Executed in completed orders only) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top Services */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-teal-600" />
                Serviços Executados em Ordens Concluídas
              </h3>
              {topServices.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">Nenhum serviço concluído no período selecionado.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {topServices.map((srv) => (
                    <div key={srv.description} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{srv.description}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Executado em {srv.frequency} OS · Qtd: {srv.total_qty}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(srv.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Parts */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-teal-600" />
                Peças Utilizadas em Ordens Concluídas
              </h3>
              {topParts.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">Nenhuma peça aplicada em ordens concluídas no período.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {topParts.map((prt) => (
                    <div key={prt.description} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{prt.description}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          Aplicada em {prt.frequency} OS · Qtd: {prt.total_qty}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(prt.total_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
