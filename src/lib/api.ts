import { setTelemetryAccessToken } from './telemetry';
import { cloudRequest } from '../services/cloudService';
import { OrderStatus, OrderPriority, DeviceType, BudgetStatus } from '../types';
// Ativação explícita de operações em nuvem via Supabase RPCs (migration 003 aplicada).
// Todas as operações de negócio utilizam a nuvem; não existe fallback silencioso ao SQLite.
export const CLOUD_OPERATIONS_ENABLED = true;
let currentCsrfToken = '';
let currentAccessToken = '';
let sessionGeneration = 0;
export function setApiCsrfToken(token: string) { currentCsrfToken = token; }
export function getApiCsrfToken() { return currentCsrfToken; }
export function setApiAccessToken(token: string) {
  if (token !== currentAccessToken) sessionGeneration += 1;
  currentAccessToken = token;
  setTelemetryAccessToken(token);
}
export function getApiAccessToken() { return currentAccessToken; }
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const epoch = sessionGeneration;
  const method = (options.method || 'GET').toUpperCase();
  let result: any;
  if (CLOUD_OPERATIONS_ENABLED && endpoint !== '/api/auth/export-legacy') {
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : undefined;
    result = await cloudRequest(endpoint, method, body);
  } else {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type')) headers.set('Content-Type','application/json');
    if (!headers.has('Authorization') && currentAccessToken) headers.set('Authorization','Bearer '+currentAccessToken);
    if (method !== 'GET' && currentCsrfToken) headers.set('X-CSRF-Token',currentCsrfToken);
    const response = await fetch(endpoint,{...options,headers,credentials:'include'});
    try { result = await response.json(); }
    catch { throw new Error('O servidor retornou uma resposta inválida. Recarregue o aplicativo e tente novamente.'); }
    if (!response.ok) throw new Error(result?.error || 'Falha de comunicação com o servidor.');
  }
  if (epoch !== sessionGeneration) throw new Error('A sessão mudou durante a operação. Confira os dados antes de tentar novamente.');
  return result as T;
}
// Format cents to Brazilian Real (BRL)
export function formatCurrency(cents: number): string {
  const safeCents = typeof cents === 'number' && !isNaN(cents) ? cents : 0;
  return (safeCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Convert cent integer to decimal string e.g. 15000 -> "150.00"
export function centsToDecimalString(cents: number): string {
  const safeCents = typeof cents === 'number' && !isNaN(cents) ? cents : 0;
  return (safeCents / 100).toFixed(2);
}

// Convert user typed currency/decimal string "150,50" or "150.50" to integer cents (15050)
export function decimalStringToCents(val: string | number): number {
  if (typeof val === 'number') return Math.round(val);
  if (!val) return 0;
  const clean = val.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Formata data preservando valores Date-Only (YYYY-MM-DD) sem distorção de fuso horário (Bug 3).
 * Evita o bug onde 00:00 UTC renderizava às 21:00 do dia anterior no Brasil (UTC-3).
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const clean = String(dateStr).trim();

  const dateOnlyMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}/${month}/${year}`;
  }

  try {
    const d = new Date(clean);
    if (isNaN(d.getTime())) return clean;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return clean;
  }
}

export function formatDateOnly(dateStr?: string | null): string {
  return formatDate(dateStr);
}

// Format ISO string to Brazilian date and time
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return formatDateOnly(isoString);
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'recebido':
      return 'Recebido';
    case 'diagnostico':
      return 'Diagnóstico';
    case 'aguardando_aprovacao':
      return 'Aguardando aprovação';
    case 'reparo':
      return 'Em reparo';
    case 'pronto':
      return 'Pronto para entrega';
    case 'entregue':
      return 'Entregue ao cliente';
    case 'cancelado':
      return 'Cancelado';
    default:
      return status;
  }
}

export function priorityLabel(priority: OrderPriority): string {
  switch (priority) {
    case 'baixa':
      return 'Baixa';
    case 'normal':
      return 'Normal';
    case 'alta':
      return 'Alta';
    case 'urgente':
      return 'Urgente';
    default:
      return priority;
  }
}

export function deviceTypeLabel(type: DeviceType): string {
  switch (type) {
    case 'smartphone':
      return 'Smartphone';
    case 'notebook':
      return 'Notebook';
    case 'computador':
      return 'Computador / Desktop';
    case 'tablet':
      return 'Tablet';
    case 'smartwatch':
      return 'Smartwatch';
    case 'outro':
      return 'Outro dispositivo';
    default:
      return type;
  }
}

export function budgetStatusLabel(status: BudgetStatus): string {
  switch (status) {
    case 'pendente':
      return 'Pendente de aprovação';
    case 'aprovado':
      return 'Orçamento aprovado';
    case 'recusado':
      return 'Orçamento recusado';
    default:
      return status;
  }
}

