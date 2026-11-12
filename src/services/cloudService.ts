import { supabase } from '../lib/supabase';
import { recordTechnicalError, captureTelemetryContext } from '../lib/telemetry';
import type { InventoryItem } from '../types';
type Payload = Record<string, unknown>;
type Rpc = (name: string, params?: Payload) => Promise<any>;
async function callRpc(name: string, params: Payload = {}): Promise<any> {
  const telemetryContext = captureTelemetryContext();
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      recordTechnicalError({ area: 'system', code: 'RPC_NOT_FOUND', severity: 'error' }, telemetryContext);
      throw new Error('As operações em nuvem ainda não foram ativadas no banco de dados. Contate o responsável pelo sistema.');
    }
    if (error.code === '42501' || error.message?.includes('permission denied')) {
      recordTechnicalError({ area: 'auth', code: 'PERMISSION_DENIED', severity: 'warn' }, telemetryContext);
      throw new Error('Acesso não autorizado ou sessão expirada no Supabase. Faça login novamente.');
    }
    if (error.message?.includes('ASSINATURA_EXPIRADA') || error.code === 'P0002') {
      recordTechnicalError({ area: 'billing', code: 'SUBSCRIPTION_EXPIRED', severity: 'info' }, telemetryContext);
    } else if (error.code !== 'P0001') {
      recordTechnicalError({ area: 'system', code: 'RPC_ERROR', severity: 'error' }, telemetryContext);
    }
    const msg = error.message || (error as any).error || (error as any).details;
    throw new Error(msg || 'Não foi possível salvar ou carregar os dados. Tente novamente.');
  }
  if (data === null || data === undefined) throw new Error('O servidor não confirmou o resultado da operação.');
  return data;
}
// Lista de rotas fechada: nenhuma operação não mapeada recorre ao banco local.
export async function cloudRequest(endpoint: string, method: string, body: any, rpc: Rpc = callRpc): Promise<any> {
  const url = new URL(endpoint, 'https://tecniflow.invalid');
  const path = url.pathname, query = url.searchParams, b = body ?? {};
  const contact = () => ({p_name:b.name,p_phone:b.phone,p_whatsapp:b.whatsapp??'',p_email:b.email??'',p_document:b.document??'',p_address:b.address??'',p_notes:b.notes??''});
  const item = () => ({p_name:b.name,p_sku:b.sku??'',p_category:b.category??'geral',p_min_quantity:b.minQuantity??1,p_cost_price_cents:b.costPriceCents??0,p_sale_price_cents:b.salePriceCents??0});
  const order = () => ({p_device_type:b.deviceType,p_brand:b.brand,p_model:b.model,p_serial_imei:b.serialImei??'',p_defect_reported:b.defectReported,p_accessories:b.accessories??'',p_entry_condition:b.entryCondition??'',p_technical_diagnosis:b.technicalDiagnosis??'',p_priority:b.priority??'normal',p_estimated_delivery:b.estimatedDelivery??''});
  if (path==='/api/auth/me' && method==='GET') return rpc('tf_sync_current_user');
  if (path==='/api/legacy/import' && method==='POST') return rpc('tf_import_legacy',{p_payload:b});
  if (path==='/api/auth/logout' && method==='POST') return {success:true};
  if (path==='/api/clients') {
    if (method==='GET') return rpc('tf_get_clients',{p_search:query.get('search')??'',p_include_archived:query.get('includeArchived')==='true'});
    if (method==='POST') return rpc('tf_create_client',contact());
  }
  let m=path.match(/^\/api\/clients\/([^/]+)(?:\/(archive|unarchive))?$/);
  if (m) {
    if (method==='GET' && !m[2]) return rpc('tf_get_client_details',{p_id:m[1]});
    if (method==='PUT' && !m[2]) return rpc('tf_update_client',{p_id:m[1],...contact()});
    if (method==='POST' && m[2]) return rpc('tf_archive_client',{p_id:m[1],p_archived:m[2]==='archive'?1:0});
  }
  if (path==='/api/inventory') {
    if (method==='POST') return rpc('tf_create_inventory_item',{...item(),p_quantity:b.initialQuantity??0});
    if (method==='GET') {
      const result=await rpc('tf_get_inventory');
      const q=(query.get('search')??'').toLocaleLowerCase(), category=query.get('category');
      const rows=(result.items as InventoryItem[]).filter(i=>i.is_archived===0);
      return {items:rows.filter(i=>(!q||(i.name+' '+i.sku).toLocaleLowerCase().includes(q))&&(!category||category==='todos'||i.category===category)&&(query.get('lowStock')!=='true'||i.quantity<=i.min_quantity)),summary:{totalItems:result.summary.total_items,lowStockCount:result.summary.low_stock_count,totalCostValueCents:result.summary.total_cost_value_cents,totalSaleValueCents:result.summary.total_sale_value_cents}};
    }
  }
  m=path.match(/^\/api\/inventory\/([^/]+)(?:\/(movement))?$/);
  if (m) {
    if (method==='GET' && !m[2]) return rpc('tf_get_inventory_details',{p_id:m[1]});
    if (method==='PUT' && !m[2]) return rpc('tf_update_inventory_item',{p_id:m[1],...item()});
    if (method==='POST' && m[2]) return rpc('tf_adjust_inventory',{p_id:m[1],p_type:b.type,p_quantity:b.quantity,p_reason:b.reason});
  }
  if (path==='/api/orders') {
    if (method==='GET') return rpc('tf_get_orders',{p_status:query.get('status'),p_priority:query.get('priority'),p_search:query.get('search')});
    if (method==='POST') return rpc('tf_create_order',{p_client_id:b.clientId,...order()});
  }
  m=path.match(/^\/api\/orders\/([^/]+)(?:\/(budget(?:\/(decision|revise))?|status))?$/);
  if (m) {
    const params={p_order_id:m[1],p_version:b.version};
    if (!m[2] && method==='GET') return rpc('tf_get_order_details',{p_order_id:m[1]});
    if (!m[2] && method==='PUT') return rpc('tf_update_order',{...params,...order()});
    if (m[2]==='budget' && method==='PUT') return rpc('tf_save_budget',{...params,p_services:b.services,p_parts:b.parts});
    if (m[3]==='decision' && method==='POST') return rpc('tf_decide_budget',{...params,p_decision:b.decision,p_notes:b.notes??''});
    if (m[3]==='revise' && method==='POST') return rpc('tf_reopen_budget',params);
    if (m[2]==='status' && method==='POST') return rpc('tf_transition_order_status',{...params,p_status:b.status,p_cancellation_reason:b.cancellationReason??''});
  }
  if (path==='/api/reports/dashboard' && method==='GET') return rpc('tf_get_dashboard_stats');
  if (path==='/api/reports/period' && method==='GET') {
    const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
    return rpc('tf_get_reports',{p_start_date:query.get('startDate')||today,p_end_date:query.get('endDate')||today});
  }
  if (path==='/api/company') {
    if (method==='GET') return rpc('tf_get_company');
    if (method==='PUT') return rpc('tf_update_company',{p_name:b.name,p_document:b.document??'',p_phone:b.phone??'',p_whatsapp:b.whatsapp??'',p_email:b.email??'',p_address:b.address??'',p_warranty_terms:b.warranty_terms??'',p_receipt_notes:b.receipt_notes??''});
  }
  if (path==='/api/company/logo' && method==='PUT') {
    return rpc('tf_update_company_logo', { p_logo_data_url: b.logo_data_url ?? null });
  }
  if (path==='/api/billing/status' && method==='GET') {
    return rpc('tf_get_billing_status');
  }
  if (path==='/api/billing/create-checkout' && method==='POST') {
    try {
      const { data, error } = await supabase.functions.invoke('kiwify-checkout', { body: b });
      if (error) {
        throw new Error(error.message || 'Falha ao comunicar com o serviço de checkout.');
      }
      if (data?.error === 'billing_not_configured') {
        const err = new Error(data.message || 'A contratação online está em fase de configuração pela administração.');
        (err as any).code = 'billing_not_configured';
        throw err;
      }
      if (data?.error === 'trial_active') {
        const err = new Error(data.message || 'Período de avaliação gratuita ainda ativo.');
        (err as any).error = 'trial_active';
        (err as any).trial_ends_at = data.trial_ends_at;
        throw err;
      }
      return data;
    } catch (err: any) {
      if (err?.code === 'billing_not_configured' || err?.message?.includes('configuração') || err?.error === 'trial_active') {
        throw err;
      }
      // Se Edge Function ainda não foi implantada na infraestrutura do Supabase
      const notConfiguredErr = new Error('A contratação online está em fase de configuração pela administração. Entre em contato com o suporte para ativar sua assinatura.');
      (notConfiguredErr as any).code = 'billing_not_configured';
      throw notConfiguredErr;
    }
  }
  throw new Error('Operação não disponível neste ambiente. Nenhum dado foi salvo.');
}

