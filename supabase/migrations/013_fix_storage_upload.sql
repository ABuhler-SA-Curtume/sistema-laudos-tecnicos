-- ============================================================
-- CORREÇÃO — upload de fotos quebrou após a migração 012
-- ------------------------------------------------------------
-- A 012 removeu a policy de listagem pública do bucket
-- `fotos-laudos`. Acontece que essa era a ÚNICA policy do bucket
-- (Advisor: policy_count 1). Sem policy, o INSERT no storage
-- (upload) passou a violar o RLS de storage.objects:
--   "new row violates row-level security policy"
--
-- Aqui recriamos as policies de ESCRITA para usuários
-- autenticados (INSERT + UPDATE p/ upsert, DELETE p/ remove),
-- SEM policy de SELECT anônima — assim a listagem continua
-- fechada. A exibição das imagens usa getPublicUrl (bucket
-- público), que não depende de policy de SELECT.
-- ============================================================

-- Limpa qualquer resíduo com esses nomes
DROP POLICY IF EXISTS "fotos_laudos_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "fotos_laudos_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "fotos_laudos_delete_auth" ON storage.objects;

-- Upload (INSERT)
CREATE POLICY "fotos_laudos_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-laudos');

-- Upsert (UPDATE) — o app envia upload(..., { upsert: true })
CREATE POLICY "fotos_laudos_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-laudos')
  WITH CHECK (bucket_id = 'fotos-laudos');

-- Remover (DELETE) — usado por deletarFotoLaudo/deletarFoto
CREATE POLICY "fotos_laudos_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-laudos');
