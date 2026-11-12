# TecniFlow — Sistema de Gestão para Assistências Técnicas

Sistema completo de gestão operacional e financeira para assistências técnicas e centros de reparo, cobrindo autenticação centralizada via Supabase Auth, cadastro de clientes, controle de estoque de peças/componentes, ordens de serviço (OS) com controle de versões e transições de estado, movimentações atômicas e relatórios gerenciais com segregação de métricas orçadas e entregues.

---

## 1. Requisitos de Sistema

- **Node.js**: Versão **22.x (LTS), a partir de 22.14.0**, com suporte ao módulo `node:sqlite` para o modo local.
- **npm**: Versão **10.x** ou superior.
- **Ambiente**: Navegador moderno com suporte a ES Modules e LocalStorage.

---

## 2. Autenticação: Supabase Auth (Integrado)

O TecniFlow utiliza autenticação em nuvem através do **Supabase Auth** (@supabase/supabase-js) configurado com credenciais públicas autorizadas:

- **Project URL**: `https://aburknnkixeeqpvsyofc.supabase.co`
- **Publishable Key**: `sb_publishable_nQu4lm4w3_Zq6a-18FvlsQ_johbNzzx`
- **Variáveis de Ambiente Opcionais**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (em `.env.example`).

### Recursos de Autenticação Implementados:
1. **Cadastro e Login**:
   - `auth.signUp` e `auth.signInWithPassword`.
   - Nenhuma senha é recebida, processada ou armazenada no banco de dados local ou endpoints locais.
   - Metadados de cadastro armazenam exclusivamente: nome da empresa, documento (CNPJ/CPF), telefone, WhatsApp, endereço e nome do proprietário.
2. **Confirmação de E-mail**:
   - Respeita confirmação obrigatória de e-mail do projeto Supabase. Quando `session === null`, a interface exibe aviso claro de confirmação pendente sem liberar o painel indevidamente.
3. **Persistência e Sessão**:
   - `persistSession: true` e `autoRefreshToken: true`.
   - `onAuthStateChange` sincroniza a renovação de tokens JWT com a API sem deadlocks.
4. **Recuperação e Redefinição de Senha**:
   - `auth.resetPasswordForEmail` direciona o usuário para `#reset-password`.
   - Formulário de definição de nova senha chama `auth.updateUser({ password })`.
5. **Segurança no Backend**:
   - Todas as requisições autenticadas enviam cabeçalho `Authorization: Bearer <access_token>`.
   - Middleware `authenticateSession` valida a assinatura e expiração do JWT remotamente via `supabaseAuthClient.auth.getUser(token)`.
   - Vínculo tenant/empresa é resolvido no servidor estritamente pelo `auth_user_id` (UUID do Supabase) verificado, com isolamento multi-tenant garantido.
   - Endpoints locais rejeitam submissão de senhas com HTTP 400.

---

## 3. Estado Atual dos Dados (Escopo desta Etapa)

- **Autenticação**: Supabase Auth (Nuvem).
- **Dados Operacionais (Clientes, OS, Estoque, Relatórios)**: Persistidos localmente em SQLite (`data/tecniflow.db`) vinculados de forma idempotente ao `auth_user_id` de cada usuário autenticado.
- **Migração Data API / PostgreSQL Remoto**: O script incremental `supabase/002_auth_data_api.sql` foi gerado para revisão manual pelo supervisor. Nenhuma ferramenta tocou ou modificou o Supabase remoto nesta etapa.

---

## 4. Instalação e Execução Independente

O TecniFlow é uma aplicação completa (Full-Stack) com frontend React e backend Node.js (Express), projetada para rodar de forma 100% independente do ambiente de prévia do AI Studio.

### 4.1 Instalação das Dependências

```bash
npm install
```

### 4.2 Compilação dos Arquivos Estáticos (Frontend)

```bash
npm run build
```

Os arquivos estáticos otimizados serão gerados no diretório `dist/`.

### 4.3 Inicialização do Servidor em Modo Produção

```bash
NODE_ENV=production PORT=3000 npm start
```

O servidor Express atenderá as requisições na porta especificada (`PORT=3000`), servindo tanto a API REST (`/api/*`) quanto os arquivos compilados do frontend (`dist/index.html`).

Para verificar a saúde do servidor em execução:
```bash
curl http://localhost:3000/api/health
```

---

## 5. Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor em modo de desenvolvimento (`tsx server.ts`). |
| `npm run build` | Compila os assets do frontend com Vite para `dist/`. |
| `npm start` | Inicia o servidor Node.js full-stack em produção (`tsx server.ts`). |
| `npm test` | Executa a suíte de testes de autenticação Supabase e isolamento (`tests/supabase-auth.test.ts`). |
| `npm run lint` | Executa a verificação estática de tipos TypeScript (`tsc --noEmit`). |
| `npm run clean` | Limpa os artefatos de build gerados (`dist` e `server.js`). |
