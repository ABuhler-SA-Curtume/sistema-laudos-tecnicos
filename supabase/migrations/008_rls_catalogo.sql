-- ============================================================
-- CORREÇÃO DE SEGURANÇA: habilitar RLS nas tabelas de catálogo
-- ------------------------------------------------------------
-- O Supabase Advisor sinalizou `rls_disabled_in_public` nestas
-- tabelas. Sem RLS, qualquer pessoa com a URL + chave anon (que
-- é pública no frontend) podia ler/editar/apagar todos os dados.
--
-- Estas são tabelas de catálogo COMPARTILHADAS entre todos os
-- usuários (não têm dono). A regra: qualquer usuário AUTENTICADO
-- tem acesso total; o papel `anon` (não logado) fica sem acesso.
-- ============================================================

-- ── Habilita RLS ───────────────────────────────────────────
ALTER TABLE normas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_analises ENABLE ROW LEVEL SECURITY;

-- ── normas ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "normas_all_authenticated" ON normas;
CREATE POLICY "normas_all_authenticated"
  ON normas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── templates ──────────────────────────────────────────────
DROP POLICY IF EXISTS "templates_all_authenticated" ON templates;
CREATE POLICY "templates_all_authenticated"
  ON templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── template_analises ──────────────────────────────────────
DROP POLICY IF EXISTS "template_analises_all_authenticated" ON template_analises;
CREATE POLICY "template_analises_all_authenticated"
  ON template_analises FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── catalogo_analises ──────────────────────────────────────
DROP POLICY IF EXISTS "catalogo_analises_all_authenticated" ON catalogo_analises;
CREATE POLICY "catalogo_analises_all_authenticated"
  ON catalogo_analises FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
