-- ============================================================
-- CORREÇÃO DE SEGURANÇA — laudo_fotos
-- ------------------------------------------------------------
-- O Supabase Advisor apontou (policy_exists_rls_disabled +
-- rls_disabled_in_public) que `laudo_fotos` tinha políticas
-- mas o RLS NÃO estava habilitado. A tabela está vazia hoje,
-- por isso o teste via API não detectou (anônimo lê 0 de uma
-- tabela vazia independente do RLS).
--
-- Produção tinha uma política manual chamada `laudo_fotos_auth`
-- (diferente dos nomes da migração 005). Aqui ligamos o RLS,
-- removemos TODAS as políticas existentes (qualquer nome) e
-- recriamos apenas as de dono (via laudo pai), iguais à 005.
-- ============================================================

-- ── 1. Habilita RLS ────────────────────────────────────────
ALTER TABLE laudo_fotos ENABLE ROW LEVEL SECURITY;

-- ── 2. Remove TODAS as políticas existentes (qualquer nome) ─
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'laudo_fotos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.laudo_fotos', pol.policyname);
  END LOOP;
END $$;

-- ── 3. Recria políticas de dono (acesso via laudo pai) ─────
CREATE POLICY "laudo_fotos_select_own" ON laudo_fotos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM laudos WHERE laudos.id = laudo_fotos.laudo_id AND laudos.criador_id = auth.uid()
  ));

CREATE POLICY "laudo_fotos_insert_own" ON laudo_fotos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM laudos WHERE laudos.id = laudo_fotos.laudo_id AND laudos.criador_id = auth.uid()
  ));

CREATE POLICY "laudo_fotos_update_own" ON laudo_fotos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM laudos WHERE laudos.id = laudo_fotos.laudo_id AND laudos.criador_id = auth.uid()
  ));

CREATE POLICY "laudo_fotos_delete_own" ON laudo_fotos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM laudos WHERE laudos.id = laudo_fotos.laudo_id AND laudos.criador_id = auth.uid()
  ));
