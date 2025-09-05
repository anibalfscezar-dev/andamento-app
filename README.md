
# Seu Escritório — App Ultra Simples (PWA + Supabase)

**Objetivo**: acompanhar andamento (timeline estilo correios) e trocar arquivos. Sem backend próprio.

## Passo a passo (10 minutos)
1. **Supabase**
   - Crie um projeto e copie **Project URL** e **Anon Key**.
   - Em *Storage*, crie um bucket **privado** chamado `cases`.
   - Em *SQL Editor*, rode o script do arquivo `schema.sql` (tabelas e RLS).
   - Em *Auth › Users*, crie o usuário **operador** (email/senha).

2. **Configurar o app**
   - Abra `public/app.js` e cole `SUPABASE_URL` e `SUPABASE_ANON_KEY` nas primeiras linhas.

3. **Publicar**
   - Faça deploy da pasta `public` no **Vercel** (arrastar e soltar) ou **Netlify**.
   - Abra `/admin.html`, faça **login**, crie um processo e copie o **link do cliente**.

4. **Usar**
   - Cliente acessa o link (`/case.html?token=...`) ou usa `/` com código + CPF.
   - Envia arquivos e baixa documentos com links assinados.

## Segurança mínima
- Token por link para o cliente (não precisa de conta).
- Operador autenticado por e-mail/senha.
- Links assinados expiram em 60s; bucket privado.

Criado em 2025-09-04 15:22.
