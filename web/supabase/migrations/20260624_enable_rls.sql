-- Habilita o RLS (Row Level Security) nas tabelas do sistema
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Como é um sistema interno (CromaHUB), permitiremos acesso a qualquer usuário *autenticado*.
-- Evita ataques anônimos da internet.
CREATE POLICY "Acesso autenticado à leads" ON public.leads 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso autenticado aos chats do whatsapp" ON public.whatsapp_chats 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso autenticado às mensagens do whatsapp" ON public.whatsapp_messages 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso autenticado às configurações" ON public.settings 
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
