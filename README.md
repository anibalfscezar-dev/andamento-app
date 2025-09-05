
# App (CPF + senha) com Notificações no App do Cliente

## O que mudou
- **Login do operador**: por **CPF + senha simples** (hash SHA-256). Senha padrão sugerida: **4 primeiros dígitos do CPF**.
- **Notificações**: tabela `notifications`. O operador pode enviar avisos pelo `admin.html` e o cliente vê em `case.html`.
- Ao **adicionar um andamento**, o sistema também cria uma notificação automática: *"Novo andamento publicado."*

## Passos
1) Supabase → **Storage**: bucket **privado** `cases`.
2) Supabase → **SQL Editor**: rode `schema.sql` (cria tabelas e políticas).
3) Supabase → **Table Editor → operators**: insira pelo menos 1 operador com:
   - `cpf` (só números), `name`, `pass_hash` = SHA-256 da senha (padrão = 4 primeiros dígitos do CPF).
   - Exemplo de SQL para gerar hash: `select encode(digest('1234','sha256'),'hex');`
4) Publique a pasta `public/` no Vercel (Output Directory = `public`).

## Enviando notificações
- No `admin.html`: botão **"Enviar notificação"** (mensagem livre) e botão de **adicionar evento** (gera notificação automática).
- No `case.html`: o cliente vê a lista de avisos e pode marcar como lido ao tocar no aviso.
