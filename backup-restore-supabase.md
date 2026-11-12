# TecniFlow — backup e recuperação operacional

Atualizado em 6 de novembro de 2026. O código foi revisado e testado; o backup automático dos dados reais **ainda não está ativo**.

## Situação confirmada

| Item | Estado |
| --- | --- |
| Segurança entre empresas e assinatura no servidor | 54 verificações independentes aprovadas em banco isolado |
| Migration 010 no Supabase | Aplicada; 19 tabelas privadas com RLS e nenhum grant direto indevido |
| Telemetria técnica e diagnóstico do banco | Configurados; diagnóstico remoto retornou `ready: true` |
| Dump PostgreSQL criptografado e restauração | 16 verificações com PostgreSQL 18, pg_dump e pg_restore reais, apenas fixtures descartáveis |
| Observabilidade HTTP/React | 20 verificações independentes aprovadas |
| Backup dos dados reais / envio externo / agendamento | Pendente de conexão de banco, chave recuperável, destino permanente e executor |
| Alertas externos | Adaptador preparado e desativado; nenhum destinatário ou webhook configurado |

Este pacote de código e testes não contém cópia dos dados reais dos clientes e não é um backup operacional do banco.

## Cobertura e limites

`scripts/backup-supabase.ts` executa `pg_dump` em formato custom com os schemas `tecniflow`, `public` e `auth`. Inclui dados, funções, políticas e ACLs desses schemas; usa `--no-owner`, preservando os grants. O dump usa transação padrão somente leitura e tem timeout de 180 segundos.

O fluxo cifra o stream com AES-256-GCM, nonce aleatório e cabeçalho autenticado. Publica o arquivo `.enc.tfbak` e o manifesto somente depois da exportação e da verificação de saída do pg_dump. SHA-256 e autenticação GCM detectam corrupção. Falhas removem arquivos parciais e preservam backups anteriores. Arquivos são privados (0600), diretório privado (0700) e publicação não sobrescreve arquivos.

Ficam fora: arquivos do Supabase Storage, roles globais/plataforma, secrets das Edge Functions, credenciais externas, configurações de SMTP/domínio e implantação. Em 6/11 a consulta administrativa encontrou zero buckets e zero objetos Storage. Se arquivos forem adicionados depois, seu backup separado será necessário. Restaurar esses schemas em outro ambiente Supabase exige compatibilidade das roles/extensões da plataforma; o ensaio local não comprova migração completa de projeto.

## Ativar o backup real

1. Definir executor permanente com Node compatível, `tsx` e ferramentas PostgreSQL compatíveis com a versão do servidor. Usar um caminho absoluto e privado para saída. O armazenamento temporário do preview não atende esse requisito.
2. O proprietário informa a conexão PostgreSQL do projeto por um gerenciador de secrets do executor. Aceita `SUPABASE_DB_URL` (ou `DATABASE_URL`) ou `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` e `PGPASSWORD`. Não colar credenciais no chat, nos arquivos-fonte, em argumentos de linha de comando ou nos logs. A chave pública Supabase e o JWT do aplicativo não substituem a senha PostgreSQL.
3. Configurar `BACKUP_ENCRYPTION_KEY` com 32 bytes aleatórios representados em 64 caracteres hexadecimais ou base64 canônico de 44 caracteres. Guardar uma cópia recuperável separada dos backups, sob controle do proprietário. Frase de 32 caracteres é recusada. A chave Gemini gerenciada pelo AI Studio não serve para isso. Este trabalho não criou nem guardou uma chave de produção.
4. Configurar `BACKUP_OUTPUT_DIR` em armazenamento permanente privado. Para origem remota, exigir `sslmode=verify-full` e a CA correta (`PGSSLROOTCERT`/`sslrootcert` quando necessário). Parâmetros de URI que sobrescrevam a conexão são recusados. O script passa a senha aos clientes PostgreSQL por um passfile temporário privado e não a inclui em argv.
5. Com secrets já fornecidos ao processo, executar a partir da raiz do projeto:

   ```bash
   node --import tsx scripts/backup-supabase.ts --dry-run
   node --import tsx scripts/backup-supabase.ts
   ```

   O dry-run verifica configuração, sem conectar/exportar e sem validar entrega. O sucesso do segundo comando comprova apenas a criação local do arquivo cifrado e manifesto; o evento inclui `offsiteTransferVerified:false`.
6. Transferir **ambos** os arquivos para destino externo escolhido e verificar integridade depois da transferência. Concluir um ensaio de restauração a partir da cópia externa. Nenhum provedor externo foi escolhido ou configurado neste trabalho.
7. Só então instalar agendamento no executor. Rotina proposta: backup diário às 03h de Brasília, retenção inicial de 30 dias e ensaio de restauração mensal e após mudanças de schema. Monitorar idade do último backup com upload verificado, falha de execução e falha de restauração. Não apagar a última cópia comprovadamente restaurável ao aplicar retenção. Esses horários são uma configuração proposta; nenhum cron/timer está ativo.

## Ensaio seguro de restauração

O comando de ensaio recusa produção: exige host exato `localhost`, `127.0.0.1` ou `::1`, banco com sufixo `_restore_check`, confirmação explícita e banco realmente vazio. Também consulta endereço real do servidor e nome do banco antes de executar DDL. Não cria nem apaga bancos automaticamente e não reaproveita credenciais da origem.

O ambiente local precisa das roles/extensões referenciadas no dump, provisionadas separadamente em ambiente descartável compatível. A verificação de banco vazio não permite tabelas ou funções de usuário preexistentes. Não apontar o ensaio a um projeto existente.

Configurar somente no executor de ensaio: `RESTORE_CHECK_DB_URL` ou `RESTORE_CHECK_HOST`, `RESTORE_CHECK_PORT`, `RESTORE_CHECK_USER`, `RESTORE_CHECK_DATABASE`, `RESTORE_CHECK_PASSWORD`; `RESTORE_CHECK_SSLMODE` conforme ambiente local; `RESTORE_CHECK_CONFIRM=isolated-only`; e a chave correspondente em `BACKUP_ENCRYPTION_KEY`. `PSQL_BIN`/`PG_RESTORE_BIN` podem indicar ferramentas compatíveis. Para fixture local sem senha/TLS, é necessário opt-in explícito `BACKUP_ALLOW_LOCAL_TEST=1`; isso não deve ser usado na origem remota.

Com o arquivo e manifesto presentes no mesmo diretório e secrets já carregados:

```bash
node --import tsx scripts/restore-check-supabase.ts --file /caminho/privado/arquivo.enc.tfbak
```

A ordem é: validar manifesto/tamanho/SHA-256, autenticar e decifrar, validar formato PostgreSQL, verificar destino isolado vazio, executar `pg_restore --single-transaction --exit-on-error`, e confirmar objetos essenciais. O limite atual é 1 GiB por arquivo cifrado; acima disso o ensaio recusa o arquivo e precisará de uma implementação de restauração por streaming antes do uso.

Em 6/11 foi validado um ciclo com PostgreSQL 18.6 real em banco descartável: dados de empresas/clientes/peças/OS/identidades de teste e UTF-8 preservados, RLS e restrições de pagamento preservadas. Foram recusados destino não vazio, host disfarçado/remoto, chave errada, corrupção e truncamento. Isso não é um ensaio dos dados reais do projeto.

## Acompanhamento de falhas

`/api/health` indica processo vivo. `/api/health/ready` consulta a RPC real `tf_health_probe`, tem timeout de 3 segundos, cache de 5 segundos e retorna 503 se a dependência falhar. Um monitor externo recorrente só poderá ser ligado após existir endereço publicado e destino de aviso; ainda não está ativo.

A migration 010 configura `tecniflow.error_telemetry` e a RPC autenticada `tf_record_error_telemetry`. A empresa e o usuário são derivados de `auth.uid()`. Só aceita área/código fixos, severidade derivada no servidor e UUID de correlação. Não armazena mensagens de clientes, stack, e-mail, CPF, token, URL ou corpo de requisição. Há deduplicação de 60 segundos, limite de 10 eventos/minuto/usuário e 200/dia/empresa, protegidos por trava transacional. O expurgo de registros com mais de 30 dias acontece por empresa durante nova ingestão; não existe limpeza agendada global.

O cliente cancela eventos pendentes e descarta contextos antigos ao trocar sessão; no máximo três envios técnicos simultâneos, sem fila persistente. Falhar ao registrar um erro não repete a operação financeira ou de negócio. O ErrorBoundary apresenta mensagem segura, código de correlação e tentativa por ação do usuário.

Consultar a visão administrativa `tecniflow.v_admin_error_summary` no SQL Editor do Supabase. A consulta **TecniFlow — Monitoramento de falhas**, salva no SQL Editor do Supabase, mostra diagnóstico, resumo de sete dias e recorrência de cinco erros em 15 minutos. Abrir: https://supabase.com/dashboard/project/aburknnkixeeqpvsyofc/sql/9f5aafd6-c433-4ed2-a21d-18d06affb0f0 . Ela apenas sinaliza atenção; não envia notificações. Usuários comuns do aplicativo não têm acesso à tabela ou à visão administrativa.

`CRITICAL_ALERT_WEBHOOK_URL` é opcional e server-only. O adaptador aceita HTTPS sem credenciais embutidas, não segue redirecionamentos, limita volume e timeout e envia só campos técnicos fixos. Antes da ativação, definir e verificar destino e autenticação. Nenhum envio externo foi executado.

## Pendências para concluir a operação real

- Escolha e configuração de destino externo permanente e executor de backup.
- Entrada segura de credencial PostgreSQL e chave de criptografia recuperável.
- Primeiro dump real, upload verificado e restauração comprovada a partir dessa cópia.
- Instalação do agendamento e avisos de atraso/falha do backup.
- Escolha de destino de alertas e teste autorizado de entrega.
- Endereço público para acompanhamento externo de disponibilidade.

GitHub, Netlify, domínio e publicação permanecem para a etapa final solicitada pelo proprietário.
