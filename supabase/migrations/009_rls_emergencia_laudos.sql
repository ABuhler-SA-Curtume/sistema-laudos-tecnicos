-- ============================================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA (URGENTE)
-- ------------------------------------------------------------
-- Teste via API REST com a chave anon (pública) provou que as
-- tabelas `laudos`, `analises` e `users` estavam totalmente
-- abertas: qualquer pessoa não autenticada conseguia LER e
-- APAGAR/ALTERAR todos os registros (58 laudos, 477 análises,
-- 2 usuários expostos).
--
-- As políticas RLS já tinham sido definidas na migração 001,
-- mas o RLS NÃO estava efetivamente habilitado nessas tabelas
-- em produção (o ENABLE foi pulado ou desligado depois).
--
-- Esta migração reativa o RLS e recria as políticas de dono,
-- de forma idempotente.
-- ============================================================

-- ── 1. Reativa RLS ─────────────────────────────────────────
ALTER TABLE laudos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;

-- ── 2. laudos: acesso só do criador ────────────────────────
DROP POLICY IF EXISTS "laudos_select_own" ON laudos;
DROP POLICY IF EXISTS "laudos_insert_own" ON laudos;
DROP POLICY IF EXISTS "laudos_update_own" ON laudos;
DROP POLICY IF EXISTS "laudos_delete_own" ON laudos;

CREATE POLICY "laudos_select_own"
  ON laudos FOR SELECT TO authenticated
  USING (criador_id = auth.uid());

CREATE POLICY "laudos_insert_own"
  ON laudos FOR INSERT TO authenticated
  WITH CHECK (criador_id = auth.uid());

CREATE POLICY "laudos_update_own"
  ON laudos FOR UPDATE TO authenticated
  USING (criador_id = auth.uid())
  WITH CHECK (criador_id = auth.uid());

CREATE POLICY "laudos_delete_own"
  ON laudos FOR DELETE TO authenticated
  USING (criador_id = auth.uid());

-- ── 3. analises: acesso via dono do laudo pai ──────────────
DROP POLICY IF EXISTS "analises_select_own" ON analises;
DROP POLICY IF EXISTS "analises_insert_own" ON analises;
DROP POLICY IF EXISTS "analises_update_own" ON analises;
DROP POLICY IF EXISTS "analises_delete_own" ON analises;

CREATE POLICY "analises_select_own"
  ON analises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM laudos
      WHERE laudos.id = analises.laudo_id
        AND laudos.criador_id = auth.uid()
    )
  );

CREATE POLICY "analises_insert_own"
  ON analises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM laudos
      WHERE laudos.id = analises.laudo_id
        AND laudos.criador_id = auth.uid()
    )
  );

CREATE POLICY "analises_update_own"
  ON analises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM laudos
      WHERE laudos.id = analises.laudo_id
        AND laudos.criador_id = auth.uid()
    )
  );

CREATE POLICY "analises_delete_own"
  ON analises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM laudos
      WHERE laudos.id = analises.laudo_id
        AND laudos.criador_id = auth.uid()
    )
  );

-- ── 4. users: cada um só vê/edita o próprio registro ───────
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

CREATE POLICY "users_select_own"
  ON users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own"
  ON users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
