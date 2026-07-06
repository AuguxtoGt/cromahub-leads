-- Migration: Multi-tenancy (20260706_multitenancy.sql)

-- 1. Add user_id to leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add user_id to whatsapp_chats
ALTER TABLE public.whatsapp_chats 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Add user_id to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Add user_id to settings
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- (Optional) Se havia uma restrição de primary key em `id = 'default'` na settings,
-- agora o user_id deve ser o identificador único para as configurações de cada conta.
-- Criamos um índice único para garantir uma configuração por usuário.
CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_idx ON public.settings(user_id);

-- 5. Enable RLS no banco de dados
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6. Remover QUALQUER policy antiga para evitar que regras permissivas antigas anulem nossa segurança
DO $$ 
DECLARE 
    r record;
BEGIN 
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('leads', 'whatsapp_chats', 'whatsapp_messages', 'settings')) 
    LOOP 
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename); 
    END LOOP;
END $$;

-- 7. Criar a política estrita de multi-tenancy
CREATE POLICY "Isolamento multi-tenant" ON public.leads FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Isolamento multi-tenant" ON public.whatsapp_chats FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Isolamento multi-tenant" ON public.whatsapp_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Isolamento multi-tenant" ON public.settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 6. Trigger para auto-preencher user_id no INSERT (caso a aplicação esqueça)
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_leads_user_id ON public.leads;
CREATE TRIGGER set_leads_user_id
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_settings_user_id ON public.settings;
CREATE TRIGGER set_settings_user_id
  BEFORE INSERT ON public.settings
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_whatsapp_chats_user_id ON public.whatsapp_chats;
CREATE TRIGGER set_whatsapp_chats_user_id
  BEFORE INSERT ON public.whatsapp_chats
  FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_whatsapp_messages_user_id ON public.whatsapp_messages;
CREATE TRIGGER set_whatsapp_messages_user_id
  BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION set_user_id();
