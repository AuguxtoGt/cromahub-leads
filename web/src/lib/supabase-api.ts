import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Retorna o cliente do Supabase correto para a rota de API.
 * 
 * Se for uma chamada do n8n (Server-to-Server) com API_KEY válida, 
 * retorna o `supabaseAdmin` (bypassa RLS).
 * 
 * Se for uma chamada do navegador, verifica se o usuário está logado
 * e retorna o `supabase` client autenticado com seus cookies (respeita RLS).
 * 
 * Se não for nenhum, lança um erro 401.
 */
export async function getDbClient(req: Request) {
  const authHeader = req.headers.get('authorization');
  const apiKey = process.env.API_KEY;

  // Verifica se é uma chamada de sistema/n8n
  if (apiKey && authHeader && authHeader === `Bearer ${apiKey}`) {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não configurada. Acesso de sistema bloqueado.');
      throw new Error('Configuração de servidor inválida');
    }
    return supabaseAdmin;
  }

  // Caso contrário, é uma chamada de usuário, usar client autenticado
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return supabase;
}
