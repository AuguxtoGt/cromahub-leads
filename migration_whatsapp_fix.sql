-- ================================================================
-- Migration: WhatsApp Integration Fixes
-- CromaHub Leads — cromahub-leads
-- Data: 2025-05-28
-- ================================================================
-- COMO APLICAR:
-- 1. Acesse: https://supabase.com/dashboard → seu projeto → SQL Editor
-- 2. Cole todo este conteúdo e clique em "Run"
-- ================================================================

-- ── 1. Adicionar phone_normalized na tabela whatsapp_chats ──────
-- Essa coluna vai guardar apenas os dígitos do número (sem @lid/@s.whatsapp.net)
-- e ser a chave única para evitar chats duplicados

ALTER TABLE whatsapp_chats
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT;

-- Popula a coluna com os dados existentes (remove tudo que não é dígito)
UPDATE whatsapp_chats
  SET phone_normalized = regexp_replace(
    split_part(remote_jid, '@', 1),
    '[^0-9]',
    '',
    'g'
  )
  WHERE phone_normalized IS NULL;

-- Cria índice único para impedir duplicatas futuras
-- (usa IF NOT EXISTS para ser idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'whatsapp_chats'
    AND indexname = 'whatsapp_chats_phone_normalized_key'
  ) THEN
    CREATE UNIQUE INDEX whatsapp_chats_phone_normalized_key
      ON whatsapp_chats (phone_normalized)
      WHERE phone_normalized IS NOT NULL;
  END IF;
END $$;

-- ── 2. Remove chats duplicados (mantém o mais antigo por número) ─
-- Identifica duplicatas pelo phone_normalized e deleta os mais novos
DELETE FROM whatsapp_chats
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY phone_normalized
          ORDER BY created_at ASC  -- mantém o mais antigo
        ) AS rn
      FROM whatsapp_chats
      WHERE phone_normalized IS NOT NULL
    ) ranked
    WHERE rn > 1  -- deleta todos exceto o primeiro (mais antigo)
  );

-- ── 3. Adicionar media_type na tabela whatsapp_messages ─────────
-- Facilita renderização correta (TEXT, AUDIO, IMAGE, VIDEO, FILE)

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'TEXT';

-- Popula media_type baseado no conteúdo existente
UPDATE whatsapp_messages SET media_type = 'AUDIO' WHERE content LIKE '[AUDIO]%' AND media_type = 'TEXT';
UPDATE whatsapp_messages SET media_type = 'AUDIO' WHERE content = '🎵 Áudio' AND media_type = 'TEXT';
UPDATE whatsapp_messages SET media_type = 'IMAGE' WHERE content LIKE '[IMAGE]%' AND media_type = 'TEXT';
UPDATE whatsapp_messages SET media_type = 'IMAGE' WHERE content = '📷 Imagem' AND media_type = 'TEXT';
UPDATE whatsapp_messages SET media_type = 'FILE'  WHERE content LIKE '📄%'     AND media_type = 'TEXT';

-- ── 4. Habilitar Realtime (atualização em tempo real no painel) ──
-- Necessário para o Supabase Realtime enviar mudanças ao frontend

ALTER TABLE whatsapp_chats    REPLICA IDENTITY FULL;
ALTER TABLE whatsapp_messages REPLICA IDENTITY FULL;

-- Adicionar as tabelas na publicação do Realtime
-- (esse comando é idempotente — não falha se já existir)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_chats;
  EXCEPTION WHEN others THEN
    -- Tabela já está na publicação, ignorar
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
  EXCEPTION WHEN others THEN
    -- Tabela já está na publicação, ignorar
  END;
END $$;

-- ── 5. Verificação ───────────────────────────────────────────────
-- Rode estas queries para confirmar que tudo foi aplicado:
/*
SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'whatsapp_chats'
  ORDER BY ordinal_position;

SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'whatsapp_messages'
  ORDER BY ordinal_position;

SELECT COUNT(*) as total_chats FROM whatsapp_chats;
SELECT phone_normalized, COUNT(*) FROM whatsapp_chats GROUP BY phone_normalized;
*/
