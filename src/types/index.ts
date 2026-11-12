export type DeviceType = 'smartphone' | 'notebook' | 'computador' | 'tablet' | 'smartwatch' | 'outro';

export type OrderPriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export type OrderStatus =
  | 'recebido'
  | 'diagnostico'
  | 'aguardando_aprovacao'
  | 'reparo'
  | 'pronto'
  | 'entregue'
  | 'cancelado';

export type BudgetStatus = 'pendente' | 'aprovado' | 'recusado';

export type InventoryMovementType = 'entrada' | 'saida_manual' | 'saida_os' | 'estorno_os';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired';

export interface BillingPayment {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'approved' | 'pending' | 'rejected' | 'refunded' | 'charged_back';
  payment_date: string;
}

export interface BillingStatus {
  is_owner: boolean;
  status: SubscriptionStatus;
  raw_status: SubscriptionStatus;
  is_active: boolean;
  can_operate: boolean;
  plan_code: string;
  plan_name: string;
  amount_cents: number;
  currency: string;
  billing_cycle: string;
  trial_starts_at?: string;
  trial_ends_at?: string;
  trial_days_remaining: number;
  current_period_starts_at?: string;
  current_period_ends_at?: string;
  cancel_at_period_end: boolean;
  payments: BillingPayment[];
  server_time: string;
}

export interface Company {
  id: string;
  name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  warranty_terms: string;
  receipt_notes: string;
  company_logo_data_url?: string | null;
}

export interface User {
  id: string;
  company_id: string;
  name: string;
  email: string;
  role: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  document?: string;
  address?: string;
  notes?: string;
  is_archived: number;
  total_orders?: number;
  created_at: string;
  updated_at: string;
}

export interface OrderServiceItem {
  id: string;
  order_id: string;
  description: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
}

export interface OrderPartItem {
  id: string;
  order_id: string;
  inventory_item_id?: string | null;
  inventory_item_name?: string | null;
  current_stock_quantity?: number | null;
  description: string;
  unit_price_cents: number;
  quantity: number;
  total_cents: number;
  inventory_debited: number;
}

export interface OrderHistoryItem {
  id: string;
  order_id: string;
  action: string;
  description: string;
  user_name: string;
  created_at: string;
}

export interface Order {
  id: string;
  company_id: string;
  order_number: number;
  client_id: string;
  client_name?: string;
  client_phone?: string;
  client_whatsapp?: string;
  client_email?: string;
  client_document?: string;
  client_address?: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  serial_imei: string;
  defect_reported: string;
  accessories: string;
  entry_condition: string;
  technical_diagnosis: string;
  priority: OrderPriority;
  estimated_delivery: string;
  status: OrderStatus;
  cancellation_reason?: string;
  budget_status: BudgetStatus;
  budget_approved_at?: string;
  budget_approved_by?: string;
  total_services_cents: number;
  total_parts_cents: number;
  total_amount_cents: number;
  version: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  min_quantity: number;
  cost_price_cents: number;
  sale_price_cents: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  company_id: string;
  item_id: string;
  type: InventoryMovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  order_id?: string;
  reason: string;
  user_name: string;
  created_at: string;
}

export interface DashboardMetrics {
  inProgressCount: number;
  awaitingApprovalCount: number;
  readyForPickupCount: number;
  deliveredCount: number;
  cancelledCount: number;
  totalOrdersCount: number;
  totalDeliveredCents: number;
  totalBudgetedCents: number;
  totalClients: number;
  lowStockCount: number;
}

export interface PeriodReportSummary {
  totalOrders: number;
  totalBudgetedCents: number;
  totalDeliveredCents: number;
  deliveredCount: number;
  cancelledCount: number;
  avgHoursTurnaround: number | null;
}
