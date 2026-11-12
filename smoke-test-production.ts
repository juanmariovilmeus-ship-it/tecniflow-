import http from 'node:http';
import { createApp } from '../server.js';
import { mainDb } from '../server/db.js';
import path from 'node:path';
import fs from 'node:fs';

async function runProductionSmokeTest() {
  console.log('================================================================');
  console.log('  TECNIFLOW - SMOKE TEST DO SERVIDOR EM MODO PRODUÇÃO');
  console.log('================================================================\n');

  // Ensure dist exists
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Diretório dist/ não encontrado. Execute npm run build antes.');
  }

  process.env.NODE_ENV = 'production';
  const app = createApp(mainDb);

  // Serve static dist just like startServer does in production
  const { default: express } = await import('express');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(distDir, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(3099, '127.0.0.1', () => resolve());
  });

  console.log('[Smoke Test] Servidor de produção ativo em http://127.0.0.1:3099');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Health check endpoint
    const healthRes = await fetch('http://127.0.0.1:3099/api/health');
    const healthBody = await healthRes.json();
    assert(
      healthRes.status === 200 && healthBody.status === 'ok' && healthBody.provider === 'sqlite',
      '1. Endpoint /api/health responde HTTP 200 em modo produção com provider sqlite',
      JSON.stringify(healthBody)
    );

    // 2. Main HTML entry point
    const htmlRes = await fetch('http://127.0.0.1:3099/');
    const htmlText = await htmlRes.text();
    assert(
      htmlRes.status === 200 && htmlText.includes('id="root"') && htmlText.includes('TecniFlow'),
      '2. Página principal (/) serve index.html com container root e título TecniFlow'
    );

    // 3. Static CSS asset
    const distFiles = fs.readdirSync(path.join(distDir, 'assets'));
    const cssFile = distFiles.find(f => f.endsWith('.css'));
    if (cssFile) {
      const cssRes = await fetch(`http://127.0.0.1:3099/assets/${cssFile}`);
      assert(
        cssRes.status === 200 && (cssRes.headers.get('content-type') || '').includes('text/css'),
        `3. Asset CSS estático (/assets/${cssFile}) servido com HTTP 200 e content-type text/css`
      );
    }

    // 4. Static JS asset
    const jsFile = distFiles.find(f => f.endsWith('.js'));
    if (jsFile) {
      const jsRes = await fetch(`http://127.0.0.1:3099/assets/${jsFile}`);
      assert(
        jsRes.status === 200 && (jsRes.headers.get('content-type') || '').includes('javascript'),
        `4. Asset JS compilado (/assets/${jsFile}) servido com HTTP 200 e content-type javascript`
      );
    }

    // 5. Verification that real database has 0 records
    const tables = [
      'companies', 'users', 'sessions', 'clients', 'inventory_items',
      'orders', 'order_services', 'order_parts', 'inventory_movements', 'order_history'
    ];
    let allEmpty = true;
    for (const t of tables) {
      const row = await mainDb.queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM ${t}`);
      if (!row || Number(row.c) !== 0) {
        allEmpty = false;
        console.error(`Tabela ${t} possui ${row?.c} registros!`);
      }
    }
    assert(
      allEmpty,
      '5. Banco de dados real (data/tecniflow.db) permanece rigorosamente limpo com 0 registros após smoke test'
    );

  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    console.log('\n[Smoke Test] Servidor encerrado.');
  }

  console.log('\n================================================================');
  console.log(`  RESULTADO SMOKE TEST: ${passed} passaram, ${failed} falharam.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionSmokeTest().catch((err) => {
  console.error('Falha no smoke test:', err);
  process.exit(1);
});
