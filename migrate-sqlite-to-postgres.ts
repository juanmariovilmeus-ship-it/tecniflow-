import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { REQUIRED_TECNIFLOW_TABLES, PostgresAdapter } from '../server/db/postgres.js';

const SQLITE_FILE = path.resolve(process.cwd(), 'data', 'tecniflow.db');

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

  console.log('================================================================');
  console.log('  TECNIFLOW - SCRIPT DE TRANSFERÊNCIA/MIGRAÇÃO SQLITE -> POSTGRES');
  console.log(`  Modo: ${isDryRun ? 'DRY-RUN (Simulação e Validação segura)' : 'EXECUTE (Transferência Real)'}`);
  console.log('================================================================\n');

  if (!fs.existsSync(SQLITE_FILE)) {
    console.log(`[Aviso] Banco SQLite não encontrado em ${SQLITE_FILE}. Nada a migrar.`);
    process.exit(0);
  }

  const sqliteDb = new DatabaseSync(SQLITE_FILE);

  // 1. Consistent local backup copy using VACUUM INTO
  const backupFilename = `tecniflow_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
  const backupPath = path.resolve(process.cwd(), 'data', backupFilename);

  try {
    sqliteDb.exec(`VACUUM INTO '${backupPath}';`);
    console.log(`[Backup] Cópia consistente criada em: data/${backupFilename}`);
  } catch (err: any) {
    console.error(`[Backup] Erro ao criar cópia consistente: ${err.message}`);
    process.exit(1);
  }

  // 2. Count records from SQLite (never read or expose sensitive values)
  const counts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of REQUIRED_TECNIFLOW_TABLES) {
    try {
      const row = sqliteDb.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
      const count = Number(row?.c || 0);
      counts[table] = count;
      totalRows += count;
    } catch {
      counts[table] = 0;
    }
  }

  console.log('\n[Contagem de Registros na Origem SQLite]');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  - ${table.padEnd(22)}: ${count} registro(s)`);
  }
  console.log(`  TOTAL: ${totalRows} registro(s)`);

  if (totalRows === 0) {
    console.log('\n[Informação] O banco SQLite de origem está com 0 registros em todas as tabelas.');
    console.log('[Informação] Nenhuma linha precisa ser transferida.');
    sqliteDb.close();
    process.exit(0);
  }

  if (isDryRun) {
    console.log('\n[Dry-Run Concluído com Sucesso]');
    console.log('- Backup consistente local gerado com sucesso.');
    console.log('- Nenhuma alteração foi realizada no PostgreSQL/Supabase.');
    console.log('- Para executar a transferência real após confirmação da conexão, execute:');
    console.log('    npx tsx scripts/migrate-sqlite-to-postgres.ts --execute\n');
    sqliteDb.close();
    process.exit(0);
  }

  // 3. Execution mode (only when --execute is explicitly supplied)
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !databaseUrl.trim()) {
    console.error('[Erro] DATABASE_URL não configurada no ambiente para a transferência.');
    sqliteDb.close();
    process.exit(1);
  }

  const adapter = new PostgresAdapter(databaseUrl);
  console.log('\n[PostgreSQL] Validando conexão com Supabase e schema tecniflow...');
  await adapter.testConnection();
  console.log('[PostgreSQL] Conexão e schema validados com sucesso.');

  // Transfer data table by table inside a single PostgreSQL transaction
  console.log('\n[PostgreSQL] Iniciando transferência transacional...');
  await adapter.withTransaction(async (tx) => {
    for (const table of REQUIRED_TECNIFLOW_TABLES) {
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.join(', ');
      const placeholders = columns.map(() => '?').join(', ');

      const conflictClause = table === 'login_attempts'
        ? 'ON CONFLICT (identifier) DO NOTHING'
        : table === 'orders'
          ? 'ON CONFLICT (company_id, order_number) DO NOTHING'
          : 'ON CONFLICT (id) DO NOTHING';

      const insertSql = `INSERT INTO tecniflow.${table} (${colList}) VALUES (${placeholders}) ${conflictClause}`;

      let insertedCount = 0;
      for (const row of rows) {
        const values = columns.map((col) => row[col]);
        const res = await tx.execute(insertSql, values);
        if (res.changes > 0) insertedCount++;
      }

      console.log(`  ✓ ${table}: ${insertedCount} de ${rows.length} inseridos.`);
    }
  });

  console.log('\n[Sucesso] Transferência transacional concluída sem erros.');
  sqliteDb.close();
  await adapter.close();
}

main().catch((err) => {
  console.error('[Erro Fatal na Migração]', err.message || err);
  process.exit(1);
});
