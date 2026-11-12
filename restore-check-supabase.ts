#!/usr/bin/env node
// Restore drill only: an empty database on a loopback host, explicitly confirmed.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {decryptBackupFile,parseEncryptionKey,hashFile} from '../server/lib/backupCrypto.js';
import {parsePgConnection,makePrivatePgEnv,PgConnection} from './backup-supabase.js';

export function assertSafeRestoreTarget(dbUrl?:string,host?:string,database?:string):void {
  if(dbUrl){
    const parsed=new URL(dbUrl);
    if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('RESTORE_TARGET_INVALID');
    host=parsed.hostname;database=decodeURIComponent(parsed.pathname.slice(1));
    for(const key of parsed.searchParams.keys())if(!['sslmode','sslrootcert'].includes(key))throw new Error('RESTORE_TARGET_OPTION_FORBIDDEN');
  }
  if(!['localhost','127.0.0.1','::1','[::1]'].includes((host||'').toLowerCase())||!database||!/^[a-zA-Z0-9_-]+_restore_check$/.test(database))throw new Error('RESTORE_PRODUCTION_TARGET_BLOCKED');
}

export async function verifyAndDecryptBackup(file:string,rawKey:string,manifestFile?:string):Promise<{valid:boolean;decryptedSql?:Buffer;error?:string}> {
  try {
    const metadataPath=manifestFile||file.replace(/\.enc\.tfbak$/,'.manifest.json');
    if(metadataPath===file)throw new Error('MANIFEST_REQUIRED');
    const manifest=JSON.parse(await fs.promises.readFile(metadataPath,'utf8'));
    const stat=await fs.promises.stat(file);
    if(manifest.dumpFormat!=='custom'||manifest.integrity?.fileName!==path.basename(file)||manifest.integrity?.fileSizeBytes!==stat.size||!/^[a-f0-9]{64}$/.test(manifest.integrity?.sha256||''))throw new Error('MANIFEST_INVALID');
    if(await hashFile(file)!==manifest.integrity.sha256)throw new Error('BACKUP_CHECKSUM_FAILED');
    const archive=await decryptBackupFile(file,parseEncryptionKey(rawKey));
    if(archive.subarray(0,5).toString()!=='PGDMP')throw new Error('BACKUP_NOT_POSTGRES_ARCHIVE');
    return {valid:true,decryptedSql:archive};
  } catch {return {valid:false,error:'BACKUP_VERIFICATION_FAILED'};}
}

export async function runTool(binary:string,args:string[],env:NodeJS.ProcessEnv,input?:Buffer):Promise<string> {
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{env,stdio:['pipe','pipe','pipe']});
    let out='',failed=false;
    const timer=setTimeout(()=>{failed=true;child.kill('SIGKILL');},300000);
    child.stdout?.on('data',(data:Buffer)=>{if(out.length<8192)out+=data.toString('utf8');});
    child.stderr?.on('data',()=>{});
    child.stdin?.on('error',()=>{});
    child.once('error',()=>{clearTimeout(timer);reject(new Error('RESTORE_TOOL_UNAVAILABLE'));});
    child.once('close',code=>{clearTimeout(timer);if(code!==0||failed)reject(new Error('RESTORE_TOOL_FAILED'));else resolve(out);});
    child.stdin?.end(input);
  });
}
export async function runRestoreCheck(file:string,rawKey:string,connection:PgConnection,confirmIsolated:boolean):Promise<{success:boolean;errorCode?:string;verified?:boolean}> {
  let auth:Awaited<ReturnType<typeof makePrivatePgEnv>>|undefined;
  try {
    assertSafeRestoreTarget(undefined,connection.host,connection.database);
    if(!confirmIsolated)throw new Error('RESTORE_EXPLICIT_CONFIRMATION_REQUIRED');
    const backup=await verifyAndDecryptBackup(file,rawKey);
    if(!backup.valid)throw new Error('BACKUP_VERIFICATION_FAILED');
    auth=await makePrivatePgEnv(connection);
    const psql=process.env.PSQL_BIN||'psql';
    const inspection=JSON.parse((await runTool(psql,['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('database',current_database(),'address',host(inet_server_addr()),'objects',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'),'functions',(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'));"],auth.env)).trim());
    if(inspection.database!==connection.database||!['127.0.0.1','::1'].includes(inspection.address)||Number(inspection.objects)!==0||Number(inspection.functions)!==0)throw new Error('RESTORE_TARGET_NOT_EMPTY_OR_NOT_LOCAL');
    // The empty local target is verified before any DDL is allowed to run.
    await runTool(process.env.PG_RESTORE_BIN||'pg_restore',['--exit-on-error','--single-transaction','--no-owner','--clean','--if-exists','--dbname',connection.database],auth.env,backup.decryptedSql);
    const verified=JSON.parse((await runTool(psql,['-X','-A','-t','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('business_tables',to_regclass('tecniflow.companies') IS NOT NULL AND to_regclass('tecniflow.users') IS NOT NULL AND to_regclass('tecniflow.orders') IS NOT NULL,'auth_users',to_regclass('auth.users') IS NOT NULL,'company_rpc',to_regprocedure('public.tf_get_company()') IS NOT NULL);"],auth.env)).trim());
    if(!verified.business_tables||!verified.auth_users||!verified.company_rpc)throw new Error('RESTORE_REQUIRED_OBJECTS_MISSING');
    console.log(JSON.stringify({event:'restore_check_completed',isolated:true,archiveApplied:true,requiredObjectsVerified:true,productionRestored:false}));
    return {success:true,verified:true};
  } catch(error) {
    const allowed=new Set(['RESTORE_TARGET_NOT_EMPTY_OR_NOT_LOCAL','RESTORE_TOOL_FAILED','RESTORE_TOOL_UNAVAILABLE','BACKUP_VERIFICATION_FAILED','RESTORE_REQUIRED_OBJECTS_MISSING','RESTORE_EXPLICIT_CONFIRMATION_REQUIRED','RESTORE_PRODUCTION_TARGET_BLOCKED']);
    const candidate=error instanceof Error?error.message:'';const code=allowed.has(candidate)?candidate:'RESTORE_CHECK_FAILED';
    console.error(JSON.stringify({event:'restore_check_failed',code}));return {success:false,errorCode:code};
  }
  finally {await auth?.cleanup();}
}

async function main(){
  const index=process.argv.indexOf('--file'),file=process.argv[index+1];
  if(index<0||!file){process.exitCode=1;return;}
  const url=process.env.RESTORE_CHECK_DB_URL;
  try {
    assertSafeRestoreTarget(url,process.env.RESTORE_CHECK_HOST,process.env.RESTORE_CHECK_DATABASE);
    const target=parsePgConnection(url,{host:process.env.RESTORE_CHECK_HOST,port:process.env.RESTORE_CHECK_PORT,user:process.env.RESTORE_CHECK_USER,database:process.env.RESTORE_CHECK_DATABASE,password:process.env.RESTORE_CHECK_PASSWORD,sslmode:process.env.RESTORE_CHECK_SSLMODE||'prefer'});
    const result=await runRestoreCheck(file,process.env.BACKUP_ENCRYPTION_KEY||'',target,process.env.RESTORE_CHECK_CONFIRM==='isolated-only');
    process.exitCode=result.success?0:1;
  } catch {console.error(JSON.stringify({event:'restore_preflight_failed',code:'RESTORE_TARGET_BLOCKED'}));process.exitCode=1;}
}
if(process.argv[1]?.endsWith('restore-check-supabase.ts'))void main();
