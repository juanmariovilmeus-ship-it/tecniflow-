# Guia de Preparação e Implantação: GitHub Privado + Netlify (TecniFlow)

Este documento detalha a arquitetura serverless preparada para o **TecniFlow**, as variáveis de ambiente necessárias e o passo a passo seguro para implantação no Netlify e sincronização com o Supabase Auth.

---

## 1. Arquitetura de Implantação no Netlify

- **Frontend SPA (Vite + React 19 + Tailwind CSS)**:
  - Compilado via `npm run build` gerando a pasta estática `dist/`.
  - Servido diretamente pela CDN global do Netlify com cache otimizado.
- **Backend Serverless (Netlify Functions - `netlify/functions/api.ts`)**:
  - Compilado com `node_bundler = "esbuild"` sob Node 22 (`netlify.toml`).
  - **Zero acoplamento de banco local**: Não importa SQLite, `db.ts`, Vite ou listeners HTTP Express.
  - **Rotas atendidas pela Function**:
    - `GET /api/health`: Liveness probe do serviço.
    - `GET /api/health/ready`: Readiness probe consultando RPC `tf_health_probe` no Supabase com timeout de 3s e cache de 5s.
    - `GET /api/help/quota`: Consulta de cota diária do assistente virtual via Bearer token do chamador e RPCs `tf_get_company` + `tf_get_help_ai_quota_status`.
    - `POST /api/help/chat`: Atendimento com validação estrita (máx 16KB UTF-8, chave única, 1..1500 caracteres, alternância obrigatória no histórico), reserva atômica de cota via RPC `tf_reserve_help_ai_quota` e chamada controlada ao Google GenAI (`gemini-3.5-flash-lite`, timeout 15s).
    - **Bloqueio Fail-Closed**: Qualquer outra rota sob `/api/*` retorna **HTTP 410 (CLOUD_OPERATIONS_ONLY)**.
- **Cobrança / Kiwify**:
  - Opera 100% de forma desacoplada via Edge Functions nativas do Supabase (`supabase/functions/kiwify-checkout` e `supabase/functions/kiwify-webhook`). Nenhuma alteração foi realizada nem é necessária.

---

## 2. Ordem de Redirecionamentos (`netlify.toml`)

No arquivo `netlify.toml`, as rotas da API precedem obrigatoriamente o fallback SPA:

```toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "22"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# 1. API routes: roteadas para a Netlify Function ANTES do fallback SPA
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200
  force = true

# 2. SPA fallback: todas as outras rotas vão para index.html do Vite
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 3. Variáveis de Ambiente Necessárias no Netlify

Configure estas variáveis no painel do Netlify (**Site configuration** -> **Environment variables**):

### A. Variáveis de Build / Frontend (Públicas no Navegador)
| Variável | Descrição | Exemplo de Valor |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL pública do projeto Supabase | `https://aburknnkixeeqpvsyofc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública anônima do Supabase | `sb_publishable_...` ou `anon_key` |
| `VITE_SUPABASE_RESET_REDIRECT_URL` | URL de recuperação de senha pós-deploy | `https://[seu-site].netlify.app/?auth=recovery` |
| `VITE_SUPABASE_CONFIRM_REDIRECT_URL`| URL de confirmação de e-mail pós-deploy | `https://[seu-site].netlify.app/#auth-callback` |

> **Nota**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` já possuem valores canônicos configurados no projeto. As URLs de redirecionamento devem ser preenchidas assim que você obtiver o domínio no Netlify.

### B. Variáveis de Runtime Serverless (Estritamente Privadas no Netlify)
| Variável | Descrição | Regra de Segurança |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Chave da API do Google Gemini para a Central de Ajuda | **NUNCA** prefixar com `VITE_`. Apenas o backend serverless tem acesso. |
| `GEMINI_HELP_MODEL` | Modelo de IA para a Central de Ajuda | Opcional (padrão: `gemini-3.5-flash-lite`). |
| `NODE_VERSION` | Versão do Node no runtime | `22` (já declarado no `netlify.toml`). |

> **IMPORTANTE**:
> - NUNCA adicione `service_role` ou senhas de banco de dados em variáveis com prefixo `VITE_`.
> - O banco de produção opera no Supabase via RLS e RPCs autenticadas por Bearer token.

---

## 4. Etapas Pós-Deploy no Painel do Supabase Auth

Após concluir a implantação no Netlify e obter a URL do site (ex: `https://tecniflow-app.netlify.app`), atualize a configuração do Supabase para que a recuperação de senha e a confirmação de e-mail funcionem no novo domínio:

1. Acesse o painel do Supabase: **Authentication** -> **URL Configuration**.
2. **Site URL**: Altere para a URL pública principal gerada pelo Netlify:
   - Exemplo: `https://tecniflow-app.netlify.app` (ou seu domínio customizado).
3. **Redirect URLs**: Adicione as seguintes entradas na lista de URLs permitidas:
   - `https://tecniflow-app.netlify.app/*`
   - `https://tecniflow-app.netlify.app/?auth=recovery`
   - `https://tecniflow-app.netlify.app/#auth-callback`
4. Clique em **Save**.

---

## 5. Procedimento Seguro para Subir no GitHub Privado

O arquivo `.gitignore` foi reforçado para proteger todos os dados locais e credenciais:
- Exclusão estrita de `.env`, `.env.local` e `.env.*` (mantendo apenas `.env.example`).
- Exclusão de bancos SQLite locais (`data/`, `*.db`, `*.sqlite*`).
- Exclusão de dumps e backups (`backups/`, `dumps/`, `*.dump`, `*.tar`, `*.sql.gz`).
- Exclusão de cache e builds (`dist/`, `build/`, `.netlify/`, `node_modules/`).

Passos recomendados quando você for criar o repositório:
```bash
git init
git add .
git commit -m "feat: preparar aplicacao para publicacao no Netlify com serverless functions"
git branch -M main
git remote add origin https://github.com/[seu-usuario]/[seu-repositorio-privado].git
git push -u origin main
```

No Netlify:
1. Conecte ao GitHub e selecione o repositório privado.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Cadastre as variáveis de ambiente descritas na Seção 3.
5. Inicie o deploy.
