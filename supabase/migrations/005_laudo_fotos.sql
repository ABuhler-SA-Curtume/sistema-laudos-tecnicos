-- ============================================================
-- MIGRATION 005 — Tabela de fotos gerais do laudo
-- Execute no: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS laudo_fotos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  laudo_id   UUID REFERENCES laudos(id) ON DELETE CASCADE NOT NULL,
  url        TEXT NOT NULL,
  caminho    TEXT NOT NULL,
  legenda    TEXT,
  criado_em  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE laudo_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "laudo_fotos_select_own" ON laudo_fotos;
DROP POLICY IF EXISTS "laudo_fotos_insert_own" ON laudo_fotos;
DROP POLICY IF EXISTS "laudo_fotos_update_own" ON laudo_fotos;
DROP POLICY IF EXISTS "laudo_fotos_delete_own" ON laudo_fotos;

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
