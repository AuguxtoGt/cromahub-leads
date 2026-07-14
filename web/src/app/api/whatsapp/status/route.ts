import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://api.cromahub.cloud';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';

// Rota leve que só verifica o estado da conexão — sem criar/deletar nada
export async function GET(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Sem auth não é erro 500 — é apenas "não conectado" do ponto de vista do polling
      return NextResponse.json({ connected: false, reason: 'auth' });
    }

    const INSTANCE_NAME = `cromahub-${user.id}`;

    // Busca o status real salvo no banco (atualizado via webhook em tempo real)
    const { data: settings } = await supabase
      .from('settings')
      .select('whatsapp_status')
      .eq('user_id', user.id)
      .single();

    // Se no banco diz que está fechado/offline, confiamos no banco pois o webhook é a fonte da verdade
    if (settings?.whatsapp_status && settings.whatsapp_status !== 'open') {
      return NextResponse.json({ connected: false, state: settings.whatsapp_status, source: 'db' });
    }

    // Fallback: se o banco diz open ou não tem status, consulta a API
    const res = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}`, {
      headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (settings?.whatsapp_status === 'open') {
        await supabase
          .from('settings')
          .update({ 
            whatsapp_status: 'close', 
            whatsapp_status_updated_at: new Date().toISOString() 
          })
          .eq('user_id', user.id);
      }
      return NextResponse.json({ connected: false, reason: 'api' });
    }

    const data = await res.json();
    const connected = data?.status === 'WORKING';

    if (!connected && settings?.whatsapp_status === 'open') {
      await supabase
        .from('settings')
        .update({ 
          whatsapp_status: 'close', 
          whatsapp_status_updated_at: new Date().toISOString() 
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ connected, state: data?.status, source: 'api' });
  } catch (error: any) {
    // NUNCA retorna 500 — o polling do frontend não deve tratar isso como erro fatal
    console.error('Status check error:', error.message);
    return NextResponse.json({ connected: false, reason: 'error' });
  }
}
