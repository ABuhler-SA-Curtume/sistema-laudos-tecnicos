-- ============================================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA (parte 2)
-- ------------------------------------------------------------
-- Mesmo após habilitar o RLS (migração 009), `laudos` e
-- `analises` continuavam totalmente legíveis por usuários
-- anônimos. Causa: existe uma política PERMISSIVA antiga
-- concedendo acesso a `anon`/`public`. Como as políticas no
-- Postgres são somadas (OR), basta uma política pública para
-- furar toda a proteção.
--
-- A 009 só removia políticas com nomes conhecidos (`*_own`),
-- então a política pública sobreviveu. Aqui apagamos TODAS as
-- políticas dessas tabelas (qualquer nome) e recriamos apenas
-- as corretas, restritas ao dono.
-- ============================================================

-- ── 1. Garante RLS ligado ──────────────────────────────────
ALTER TABLE laudos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises ENABLE ROW LEVEL SECURITY;

-- ── 2. Remove TODAS as políticas existentes (qualquer nome) ─
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('laudos', 'analises')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── 3. Recria políticas de dono: laudos ────────────────────
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

-- ── 4. Recria políticas de dono: analises (via laudo pai) ──
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
