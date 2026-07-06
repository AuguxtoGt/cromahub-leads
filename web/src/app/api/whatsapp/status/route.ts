import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Rota leve que só verifica o estado da conexão — sem criar/deletar nada
export async function GET(req: Request) {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return NextResponse.json({ connected: false, reason: 'config' });
    }

    const supabase = await getDbClient(req);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      // Sem auth não é erro 500 — é apenas "não conectado" do ponto de vista do polling
      return NextResponse.json({ connected: false, reason: 'auth' });
    }

    const INSTANCE_NAME = `cromahub-${user.id}`;

    const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: { 'apikey': EVOLUTION_API_KEY },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ connected: false, reason: 'api' });
    }

    const data = await res.json();
    const connected = data?.instance?.state === 'open';

    return NextResponse.json({ connected, state: data?.instance?.state });
  } catch (error: any) {
    // NUNCA retorna 500 — o polling do frontend não deve tratar isso como erro fatal
    console.error('Status check error:', error.message);
    return NextResponse.json({ connected: false, reason: 'error' });
  }
}
