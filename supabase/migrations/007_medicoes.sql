-- Adiciona array de medições individuais por análise (corpos de prova)
-- O campo resultado existente passa a armazenar a média calculada
ALTER TABLE analises ADD COLUMN IF NOT EXISTS medicoes JSONB DEFAULT '[]';
