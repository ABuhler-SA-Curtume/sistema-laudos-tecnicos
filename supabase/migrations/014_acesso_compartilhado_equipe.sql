-- ============================================================
-- MODELO DE ACESSO: equipe compartilha todos os laudos
-- ------------------------------------------------------------
-- Decisão de produto: o sistema é interno e colaborativo —
-- qualquer usuário autenticado do laboratório deve ver e editar
-- TODOS os laudos (e suas análises e fotos), não só os que criou.
--
-- As policies de "dono" (criador_id = auth.uid()) das migrações
-- 009/010/011 quebravam esse fluxo: ex. ao adicionar foto a um
-- laudo criado por outra conta, o INSERT em laudo_fotos violava
-- o RLS ("new row violates row-level security policy").
--
-- Aqui trocamos para acesso total a `authenticated`. O acesso
-- anônimo (a brecha original) continua bloqueado — só usuários
-- logados passam. A tabela `users` NÃO é alterada (cada um
-- continua vendo só o próprio registro).
-- ============================================================

-- ── Remove TODAS as policies atuais das 3 tabelas ──────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('laudos', 'analises', 'laudo_fotos')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ── Garante RLS ligado ─────────────────────────────────────
ALTER TABLE laudos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE analises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE laudo_fotos ENABLE ROW LEVEL SECURITY;

-- ── Acesso total para usuários autenticados ────────────────
CREATE POLICY "laudos_all_authenticated"
  ON laudos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "analises_all_authenticated"
  ON analises FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "laudo_fotos_all_authenticated"
  ON laudo_fotos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
