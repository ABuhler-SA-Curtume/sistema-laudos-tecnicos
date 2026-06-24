-- ============================================================
-- CORREÇÃO FINAL — upload (upsert) e remoção de fotos
-- ------------------------------------------------------------
-- Diagnóstico com o token real do usuário provou:
--   • INSERT simples no bucket fotos-laudos → 200 OK
--   • Upload com `x-upsert: true` (como o app faz) → 400 RLS
--   • DELETE (remove) → 400 RLS
--
-- Causa: tanto o UPSERT quanto o DELETE do Supabase Storage
-- precisam LER (SELECT) o objeto antes de gravar/remover. Sem
-- uma policy de SELECT, a linha fica invisível e a operação
-- viola o RLS ("new row violates row-level security policy").
--
-- As migrações 013/015 criaram INSERT/UPDATE/DELETE mas NÃO
-- criaram SELECT (de propósito, pra fechar a listagem anônima).
-- Aqui adicionamos SELECT restrito a `authenticated` — o anônimo
-- continua SEM poder listar (a brecha original segue fechada).
-- ============================================================

DROP POLICY IF EXISTS "fotos_laudos_select_auth" ON storage.objects;

CREATE POLICY "fotos_laudos_select_auth"
  ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-laudos');
