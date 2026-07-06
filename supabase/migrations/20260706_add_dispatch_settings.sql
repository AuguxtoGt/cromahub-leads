-- Adicionar colunas de controle de disparo
ALTER TABLE public.settings 
  ADD COLUMN IF NOT EXISTS dispatch_start_hour INTEGER DEFAULT 8,
  ADD COLUMN IF NOT EXISTS dispatch_end_hour INTEGER DEFAULT 18,
  ADD COLUMN IF NOT EXISTS dispatch_daily_limit INTEGER DEFAULT 50;
