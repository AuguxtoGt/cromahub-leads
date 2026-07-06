-- Adicionar coluna follow_up_prompt
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS follow_up_prompt TEXT;
