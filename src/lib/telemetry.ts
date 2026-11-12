import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase';
export type ErrorArea='auth'|'billing'|'orders'|'inventory'|'clients'|'help'|'network'|'system'|'ui';
export type ErrorSeverity='info'|'warn'|'error'|'fatal';
export interface TelemetryPayload {area:ErrorArea;code:string;severity:ErrorSeverity;correlationId?:string}
const severityByCode:Record<string,ErrorSeverity>={UI_RENDER_CRASH:'error',RPC_NOT_FOUND:'error',RPC_ERROR:'error',PERMISSION_DENIED:'warn',SUBSCRIPTION_EXPIRED:'info',HELP_RATE_LIMIT:'warn',HELP_CHAT_ERROR:'error',NETWORK_FAILURE:'error',AUTH_SERVICE_ERROR:'error',BILLING_SERVICE_ERROR:'error'};
const areas=new Set<ErrorArea>(['auth','billing','orders','inventory','clients','help','network','system','ui']);
let token='',epoch=0;
const active=new Set<AbortController>();
const sent=new Map<string,number>();
export interface TelemetryContext {readonly token:string;readonly epoch:number}
export function setTelemetryAccessToken(value:string):void {
  if(value===token)return;
  token=value;epoch++;for(const controller of active)controller.abort();active.clear();sent.clear();
}
export function captureTelemetryContext():TelemetryContext{return {token,epoch};}
// No persistent queue. Snapshot bearer prevents a delayed failure being attributed to a new account.
export function recordTechnicalError(payload:TelemetryPayload,context:TelemetryContext=captureTelemetryContext()):void {
  try {
    if(!context.token||context.epoch!==epoch||context.token!==token||!areas.has(payload.area)||!Object.hasOwn(severityByCode,payload.code))return;
    const stamp=Date.now(),key=payload.area+':'+payload.code;
    if(stamp-(sent.get(key)||0)<60000||active.size>=3)return;
    if(sent.size>100)sent.clear();sent.set(key,stamp);
    const id=payload.correlationId&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(payload.correlationId)?payload.correlationId:crypto.randomUUID();
    const controller=new AbortController();active.add(controller);
    const timer=setTimeout(()=>controller.abort(),3000);
    void fetch(SUPABASE_URL+'/rest/v1/rpc/tf_record_error_telemetry',{
      method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+context.token},
      body:JSON.stringify({p_area:payload.area,p_code:payload.code,p_severity:severityByCode[payload.code],p_correlation_id:id}),signal:controller.signal,
    }).catch(()=>{}).finally(()=>{clearTimeout(timer);active.delete(controller);});
  } catch { /* Logger failure must never block or repeat the original operation. */ }
}
