# Como publicar o TecniFlow no GitHub e no Netlify

## O que foi preparado

- Arquivos locais `data/` (SQLite, backups e registros de operação) **não estão incluídos**, por segurança.
- `package-lock.json` regenerado e instalação limpa com `npm ci` validada em 12/11/2026. Envie o lockfile junto. Remova `bun.lock` antigo do repositório se existir.
- O pacote continua com o código-fonte React/Vite, configuração `netlify.toml`, Functions, scripts e migrations Supabase.
- Removido `esbuild` explicitamente declarado em `devDependencies`, pois entrava em conflito com a dependência de pares do Vite. O Vite gerencia sua versão compatível.
- A configuração do Supabase Auth, suas tabelas, políticas e a integração Kiwify **não foram alteradas nem implantadas**.

## 1. Enviar pelo GitHub Desktop (recomendado)

1. Extraia o arquivo ZIP em uma pasta do Windows, por exemplo `Documentos\TecniFlow`.
2. Instale/abra o **GitHub Desktop**: https://desktop.github.com/
3. Se você **já tem um repositório TecniFlow no GitHub**: em GitHub Desktop selecione `File > Clone repository`, escolha o repositório e a pasta local. Copie os arquivos da pasta extraída **para a raiz da pasta clonada**, preservando `src/`, `public/`, `netlify/`, `server/` e `package.json`. Não envie `data/`, `.env`, backups nem `node_modules/`. Veja a lista de alterações, faça commit e `Push origin`.
4. Se **ainda não criou repositório**: no GitHub Desktop use `File > Add local repository`, escolha a pasta extraída e aceite `Create a Repository Here` se aparecer; faça commit inicial e `Publish repository`. Marque **Keep this code private**.
5. Acesse GitHub pelo navegador para conferir se `package.json` e `netlify.toml` estão na **raiz** do repositório, não dentro de uma pasta dupla.

> O upload pelo site GitHub aceita até **100 arquivos de cada vez**. Este projeto ultrapassa esse limite; o GitHub Desktop evita selecionar tudo em lotes.

## 2. Instalação/checagem local (importante)

Com Node 22 no computador, abra um terminal na pasta do projeto:

```powershell
npm ci
npm run lint
npm run build
npm run test:netlify
```

O pacote inclui o lockfile validado. Testes locais passaram; o resultado no Netlify e os fluxos no domínio público ainda precisam ser conferidos.

## 3. Importar para o Netlify

1. Entre em https://app.netlify.com/ e escolha `Add new project > Import an existing project`.
2. Escolha GitHub, autorize o acesso ao repositório e selecione TecniFlow.
3. Confira as opções que já estão em `netlify.toml`:
   - **Base directory**: vazio (raiz do repositório)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
   - **Node**: versão 22
4. Configure as variáveis de ambiente aplicáveis em **Project configuration > Environment variables**:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`: identificadores/chave pública do seu Supabase;
   - `VITE_SUPABASE_RESET_REDIRECT_URL` e `VITE_SUPABASE_CONFIRM_REDIRECT_URL`: URLs do domínio Netlify;
   - `GEMINI_API_KEY` (se usar Central de Ajuda por IA): chave privada **apenas** para a Function (sem `VITE_`).
5. Crie o deploy e veja **Deploy logs**. Erros de instalação/build precisam ser corrigidos antes de considerar o site no ar.
6. Após publicar, teste `https://SEU-DOMINIO.netlify.app/api/health`. Deve retornar JSON com `status: "ok"`. Depois confira login/cadastro, isolamento de empresas, operações, redefinição de senha, cota de IA e cobrança.
7. Em Supabase Auth > URL Configuration, ajuste `Site URL` e `Redirect URLs` para o novo domínio (sem remover URLs válidas usadas por outros ambientes).

## 4. O que o deploy do Netlify NÃO faz

- Não executa automaticamente as migrations SQL nem publica Edge Functions no Supabase.
- Não garante que os webhooks de pagamento Kiwify já estejam ativos.
- Não transforma automaticamente SQLite local em banco remoto.
- Não comprova que o fluxo de ponta a ponta funciona; são necessários testes reais após a publicação.

**Atenção:** Nunca envie senhas, `service_role` do Supabase, segredo de webhook, tokens Kiwify ou chave privada Gemini para o GitHub ou para `VITE_*`.

## 5. Se houver erro

- `Page not found`: confira se a pasta publicada é `dist` e se a raiz do repositório contém `index.html` e `netlify.toml`.
- `Module not found` ou `npm ERR!`: execute `npm install` localmente, gere o lockfile e confira o log de dependências.
- Site abre, mas operações falham: confira as RPCs e policies necessárias no Supabase, chaves públicas, rede e logs das Functions.
- `/api/health` retorna 404: confira se a Function `netlify/functions/api.ts` foi incluída no build e se as regras de redirecionamento estão ativas.

## Atualização 12/11/2026 — Central de Ajuda

- Cota: 10 perguntas/dia/empresa, 6 por minuto/usuário; virada do dia em Brasília.
- Migração `supabase/011_help_ai_limit_10.sql` aplicada no projeto existente em 12/11/2026; incluída para novos ambientes após 009/010. Não reseta contadores.
- IA fica desligada por padrão, mesmo se uma chave existir. FAQ segue disponível sem Gemini.
- Para habilitar, primeiro confirme no Google que o projeto da chave e o modelo têm Free Tier e não estão em modalidade paga; só então configure `HELP_AI_ENABLED=true` no runtime. O aplicativo não consegue verificar a modalidade de cobrança. O limite 10 não garante gratuidade: cotas Google são compartilhadas pelo projeto. Não habilite billing.
- Se a cota gratuita acabar, o chat retorna indisponibilidade/limite, sem trocar de modelo nem tentar uma API paga.
- Não inclua chaves Gemini, service_role, segredos Kiwify, .env, bancos locais ou backups no GitHub. A URL/chave publicável Supabase não são chaves administrativas.
- Validados: npm ci, TypeScript, Vite build, bundle da Function, 58 verificações Netlify, 35 ajuda e teste de zero chamadas de rede com IA desligada.
- Este ZIP contém código-fonte: envie seus arquivos extraídos ao GitHub; não arraste o ZIP de fontes para Netlify Drop. O Netlify deve construir via repositório.

## Escopo final
Central de Ajuda somente FAQ: chat removido da interface e nenhuma chamada de cota ou Gemini ao abrir a tela. Backend IA permanece desligado para futura atualização. O projeto é web; Play Store requer empacotamento Android e validação próprios.
