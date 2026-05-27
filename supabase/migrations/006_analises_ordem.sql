-- Adiciona campo `ordem` na tabela analises para preservar a sequência definida na base de análises
ALTER TABLE analises ADD COLUMN IF NOT EXISTS ordem INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_analises_laudo_ordem ON analises(laudo_id, ordem);
