#!/usr/bin/env node
// Server-only logical PostgreSQL backup. Never log a URI, password or key.
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Transform} from 'node:stream';
import {parseEncryptionKey,encryptBackupStream,BackupManifest} from '../server/lib/backupCrypto.js';

export interface BackupConfig {
  dbUrl?:string;host?:string;port?:string;user?:string;database?:string;password?:string;
  encryptionKeyRaw?:string;outputDir:string;isDryRun:boolean;
}
export interface PgConnection {host:string;port:string;user:string;database:string;password:string;sslmode:string;rootCert?:string}
const LOCAL = new Set(['localhost','127.0.0.1','::1','[::1]']);
export function parsePgConnection(url?:string,fields:Partial<PgConnection>={}):PgConnection {
  let host=fields.host||'',port=fields.port||'5432',user=fields.user||'',database=fields.database||'postgres',password=fields.password||'';
  let sslmode=fields.sslmode||process.env.PGSSLMODE||'verify-full';
  let rootCert=fields.rootCert||process.env.PGSSLROOTCERT;
  if(url){
    const parsed=new URL(url);
    if(!['postgres:','postgresql:'].includes(parsed.protocol))throw new Error('DB_URL_INVALID');
    for(const key of parsed.searchParams.keys())if(!['sslmode','sslrootcert'].includes(key))throw new Error('DB_URL_OPTION_FORBIDDEN');
    host=parsed.hostname;port=parsed.port||'5432';user=decodeURIComponent(parsed.username);password=decodeURIComponent(parsed.password);database=decodeURIComponent(parsed.pathname.slice(1));
    sslmode=parsed.searchParams.get('sslmode')||sslmode;rootCert=parsed.searchParams.get('sslrootcert')||rootCert;
  }
  if(!/^[a-zA-Z0-9.:[\]-]+$/.test(host)||!/^\d{1,5}$/.test(port)||Number(port)>65535||Number(port)<1||!/^[a-zA-Z0-9_.-]{1,128}$/.test(user)||!/^[a-zA-Z0-9_-]{1,63}$/.test(database))throw new Error('DB_CONNECTION_INVALID');
  if(/[\r\n\0]/.test(password))throw new Error('DB_PASSWORD_INVALID');
  const local=LOCAL.has(host.toLowerCase());
  if(!password && !(local&&process.env.BACKUP_ALLOW_LOCAL_TEST==='1'))throw new Error('DB_PASSWORD_MISSING');
  if(!local && sslmode!=='verify-full')throw new Error('DB_TLS_VERIFICATION_REQUIRED');
  if(local && sslmode==='disable' && process.env.BACKUP_ALLOW_LOCAL_TEST!=='1')throw new Error('LOCAL_TEST_OPT_IN_REQUIRED');
  return {host,port,user,database,password,sslmode,rootCert};
}
export async function makePrivatePgEnv(connection:PgConnection):Promise<{env:NodeJS.ProcessEnv;cleanup:()=>Promise<void>}> {
  const directory=await fs.promises.mkdtemp(path.join(os.tmpdir(),'tecniflow-pgpass-'));
  await fs.promises.chmod(directory,0o700);
  const passfile=path.join(directory,'pgpass');
  const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/:/g,'\\:');
  await fs.promises.writeFile(passfile,[connection.host,connection.port,connection.database,connection.user,connection.password].map(escape).join(':')+'\n',{mode:0o600,flag:'wx'});
  const env:NodeJS.ProcessEnv={PATH:process.env.PATH,LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH,LANG:'C',PGHOST:connection.host,PGPORT:connection.port,PGUSER:connection.user,PGDATABASE:connection.database,PGPASSFILE:passfile,PGSSLMODE:connection.sslmode};
  if(connection.rootCert)env.PGSSLROOTCERT=connection.rootCert;
  return {env,cleanup:()=>fs.promises.rm(directory,{recursive:true,force:true})};
}
export function loadBackupConfig():BackupConfig {
  return {dbUrl:process.env.SUPABASE_DB_URL?.trim()||process.env.DATABASE_URL?.trim(),host:process.env.PGHOST,port:process.env.PGPORT,user:process.env.PGUSER,database:process.env.PGDATABASE,password:process.env.PGPASSWORD,encryptionKeyRaw:process.env.BACKUP_ENCRYPTION_KEY,outputDir:process.env.BACKUP_OUTPUT_DIR?.trim()||'',isDryRun:process.argv.includes('--dry-run')};
}
export function validateBackupConfig(config:BackupConfig):{valid:boolean;keyBuffer?:Buffer;connection?:PgConnection;errors:string[]} {
  const errors:string[]=[];let keyBuffer:Buffer|undefined,connection:PgConnection|undefined;
  try {keyBuffer=parseEncryptionKey(config.encryptionKeyRaw||'');}catch {errors.push('BACKUP_ENCRYPTION_KEY_INVALID_OR_MISSING');}
  try {connection=parsePgConnection(config.dbUrl,config);}catch {errors.push('DB_CONNECTION_INVALID_OR_MISSING');}
  if(!config.outputDir)errors.push('PERSISTENT_OUTPUT_DIRECTORY_REQUIRED');
  return {valid:errors.length===0,keyBuffer,connection,errors};
}
export async function runBackup(config:BackupConfig):Promise<{success:boolean;backupFile?:string;manifestFile?:string;errorCode?:string}> {
  const validation=validateBackupConfig(config);
  if(!validation.valid){console.error(JSON.stringify({event:'backup_preflight_failed',codes:validation.errors}));return {success:false,errorCode:'PREFLIGHT_FAILED'};}
  if(config.isDryRun){console.log(JSON.stringify({event:'backup_dry_run',configured:true,databaseExported:false,scheduleActive:false}));return {success:true};}
  const output=path.resolve(config.outputDir);let auth:Awaited<ReturnType<typeof makePrivatePgEnv>>|undefined;
  let child:ReturnType<typeof spawn>|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
  const id=crypto.randomUUID(),base='tecniflow-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+id;
  const final=path.join(output,base+'.enc.tfbak'),manifest=path.join(output,base+'.manifest.json');
  const staging=final+'.pending',manifestStaging=manifest+'.pending';let published=false,manifestPublished=false;
  try {
    await fs.promises.mkdir(output,{recursive:true,mode:0o700});
    const dir=await fs.promises.stat(output);
    if(!dir.isDirectory()||(process.platform!=='win32'&&(dir.mode&0o077)!==0))throw new Error('OUTPUT_DIRECTORY_NOT_PRIVATE');
    auth=await makePrivatePgEnv(validation.connection!);
    const args=['--format=custom','--no-owner','--strict-names','--lock-wait-timeout=5000','--schema=tecniflow','--schema=public','--schema=auth'];
    child=spawn(process.env.PG_DUMP_BIN||'pg_dump',args,{env:{...auth.env,PGOPTIONS:'-c default_transaction_read_only=on'},stdio:['ignore','pipe','pipe']});
    const dump=child;
    const exited=new Promise<number>(resolve=>{
      dump.once('error',()=>{dump.stdout?.destroy(new Error('DUMP_UNAVAILABLE'));resolve(-1);});
      dump.once('close',code=>resolve(code??-1));
    });
    dump.stderr?.on('data',()=>{}); // Never print raw provider errors or connection details.
    timer=setTimeout(()=>{dump.stdout?.destroy(new Error('DUMP_TIMEOUT'));dump.kill('SIGKILL');},180000);
    let prefix=Buffer.alloc(0),validated=false;
    const validateFormat=new Transform({transform(chunk:Buffer,_encoding,callback){
      if(validated){callback(null,chunk);return;}
      prefix=Buffer.concat([prefix,chunk]);
      if(prefix.length<5){callback();return;}
      if(prefix.subarray(0,5).toString()!=='PGDMP'){callback(new Error('DUMP_FORMAT_INVALID'));return;}
      validated=true;callback(null,prefix);prefix=Buffer.alloc(0);
    },flush(callback){callback(validated?undefined:new Error('DUMP_EMPTY'));}});
    dump.stdout!.on('error',error=>validateFormat.destroy(error));
    dump.stdout!.pipe(validateFormat);
    const [encrypted,exitCode]=await Promise.all([encryptBackupStream(validateFormat,staging,validation.keyBuffer!),exited]);
    if(exitCode!==0)throw new Error('DUMP_EXIT_FAILED');
    const data:BackupManifest={manifestVersion:'1.0',backupId:id,createdAt:new Date().toISOString(),databaseEngine:'PostgreSQL',dumpFormat:'custom',schemasIncluded:['tecniflow','public','auth'],tablesExplicit:[],storageObjectsIncluded:false,storageBackupNote:'Storage files, platform secrets and external credentials require a separate protected backup.',encryption:{algorithm:'aes-256-gcm',keySource:'ENV_BACKUP_ENCRYPTION_KEY'},integrity:{sha256:encrypted.sha256,fileSizeBytes:encrypted.fileSizeBytes,fileName:path.basename(final)}};
    await fs.promises.writeFile(manifestStaging,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
    await fs.promises.link(staging,final);published=true;
    await fs.promises.link(manifestStaging,manifest);manifestPublished=true;
    console.log(JSON.stringify({event:'backup_created',backupId:id,encrypted:true,dumpExitCode:0,offsiteTransferVerified:false}));
    return {success:true,backupFile:final,manifestFile:manifest};
  } catch {
    child?.kill('SIGKILL');
    if(published)await fs.promises.unlink(final).catch(()=>{});
    if(manifestPublished)await fs.promises.unlink(manifest).catch(()=>{});
    console.error(JSON.stringify({event:'backup_failed',code:'BACKUP_PIPELINE_FAILED'}));
    return {success:false,errorCode:'BACKUP_PIPELINE_FAILED'};
  } finally {
    if(timer)clearTimeout(timer);
    await fs.promises.unlink(staging).catch(()=>{});await fs.promises.unlink(manifestStaging).catch(()=>{});
    await auth?.cleanup();
  }
}
if(process.argv[1]?.endsWith('backup-supabase.ts'))runBackup(loadBackupConfig()).then(result=>{process.exitCode=result.success?0:1;});
