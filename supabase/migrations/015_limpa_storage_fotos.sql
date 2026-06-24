-- ============================================================
-- CORREÇÃO — upload de fotos ainda bloqueado (storage.objects)
-- ------------------------------------------------------------
-- O erro "new row violates row-level security policy" (SEM
-- "for table") vem do STORAGE, não da tabela. Mesmo com policies
-- permissivas para `authenticated` no bucket fotos-laudos, o
-- upload era barrado — sinal de que havia uma policy RESTRICTIVE
-- residual (templates antigos do tipo "...folder m0r22u_x" que
-- exigiam pasta 'public'/'private'). Policy RESTRICTIVE é somada
-- com AND e anula as permissivas.
--
-- Aqui removemos TODAS as policies de storage.objects que se
-- referem ao bucket fotos-laudos (qualquer nome, permissiva ou
-- restritiva) e recriamos um conjunto limpo e PERMISSIVO para
-- usuários autenticados. Buckets pdfs-laudos/download-laudos não
-- são tocados.
-- ============================================================

-- ── 1. Remove tudo que menciona o bucket fotos-laudos ──────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (
        COALESCE(qual, '')       LIKE '%fotos-laudos%'
        OR COALESCE(with_check, '') LIKE '%fotos-laudos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- ── 2. Recria conjunto limpo e PERMISSIVO (authenticated) ──
-- AS PERMISSIVE é o padrão, mas explicitamos para evitar ambiguidade.
CREATE POLICY "fotos_laudos_insert_auth"
  ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-laudos');

CREATE POLICY "fotos_laudos_update_auth"
  ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-laudos')
  WITH CHECK (bucket_id = 'fotos-laudos');

CREATE POLICY "fotos_laudos_delete_auth"
  ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-laudos');

-- SELECT não é necessário: bucket é público (getPublicUrl funciona
-- sem policy), e não criar SELECT mantém a listagem fechada.
