-- Adicionar coluna follow_up_enabled
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS follow_up_enabled BOOLEAN DEFAULT true;
