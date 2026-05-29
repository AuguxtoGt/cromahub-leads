-- Ativar RLS em todas as tabelas principais
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Limpar políticas existentes para evitar conflitos (opcional)
DROP POLICY IF EXISTS "Permitir leitura total para auth" ON public.leads;
DROP POLICY IF EXISTS "Permitir leitura total para auth" ON public.settings;
DROP POLICY IF EXISTS "Permitir leitura total para auth" ON public.whatsapp_chats;
DROP POLICY IF EXISTS "Permitir leitura total para auth" ON public.whatsapp_messages;

-- Criar política de acesso total para usuários autenticados via Supabase Auth
-- Isso garante que apenas você (logado no painel) possa ler e escrever
CREATE POLICY "Permitir CRUD total para usuarios autenticados" ON public.leads
    FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir CRUD total para usuarios autenticados" ON public.settings
    FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir CRUD total para usuarios autenticados" ON public.whatsapp_chats
    FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir CRUD total para usuarios autenticados" ON public.whatsapp_messages
    FOR ALL
    USING (auth.role() = 'authenticated');
