-- ============================================================
-- ENDURECIMENTO DE SEGURANÇA — avisos (WARN) do Supabase Advisor
-- ------------------------------------------------------------
-- Após fechar os ERROS de RLS (migrações 008-011), o Advisor
-- listou avisos de boas práticas. Esta migração trata os que
-- são corrigíveis via SQL. (Não vazavam dados de cliente.)
-- ============================================================

-- ── 1. search_path fixo nas funções (function_search_path_mutable)
-- Funções SECURITY DEFINER sem search_path fixo são vulneráveis a
-- hijack via schema temporário. Fixar em `public` mantém o
-- funcionamento (ambas referenciam tabelas do schema public).
ALTER FUNCTION public.handle_new_user()      SET search_path = public;
ALTER FUNCTION public.proximo_numero_laudo() SET search_path = public;

-- ── 2. Revoga EXECUTE indevido em funções SECURITY DEFINER
-- handle_new_user é uma trigger de auth.users — nunca deve ser
-- chamada via API REST (/rpc). Revoga de todos os papéis da API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- proximo_numero_laudo é chamada pelo app via rpc, mas só por
-- usuário autenticado (lib/laudosServiceSupabase.js). Revoga só
-- do anon/public; mantém authenticated.
REVOKE EXECUTE ON FUNCTION public.proximo_numero_laudo() FROM anon, public;

-- ── 3. Remove listagem pública do bucket fotos-laudos
-- (public_bucket_allows_listing)
-- O bucket é público: URLs de objeto (getPublicUrl) funcionam SEM
-- política de SELECT. A policy ampla só permitia LISTAR todos os
-- arquivos por usuários anônimos — desnecessário e expõe nomes.
-- O app nunca chama .list(), apenas getPublicUrl/upload/remove.
DROP POLICY IF EXISTS "Public read access for photos" ON storage.objects;
DROP POLICY IF EXISTS "public_read_fotos"             ON storage.objects;

-- ── 4. Remove política duplicada em catalogo_analises
-- (rls_policy_always_true)
-- Existiam DUAS políticas ALL idênticas: uma manual e a da
-- migração 008. Remove a manual; mantém catalogo_analises_all_authenticated.
DROP POLICY IF EXISTS "Autenticados podem gerenciar catalogo_analises" ON catalogo_analises;

-- NOTA: o aviso rls_policy_always_true continuará para as políticas
-- de catálogo (normas/templates/template_analises/catalogo_analises)
-- pois `USING (true)` para authenticated é INTENCIONAL — são dados
-- compartilhados que qualquer usuário logado pode gerenciar. Se um
-- dia quiser restringir gestão a admins, troque por uma checagem de
-- papel/flag de admin.
