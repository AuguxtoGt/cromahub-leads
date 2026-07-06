import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Rota leve que só verifica o estado da conexão — sem criar/deletar nada
export async function GET(req: Request) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json({ connected: false, error: 'Configuração ausente' }, { status: 500 });
  }

  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ connected: false }, { status: 401 });

    const INSTANCE_NAME = `cromahub-${user.id}`;

    const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: { 'apikey': EVOLUTION_API_KEY },
      // timeout curto para não travar a UI
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return NextResponse.json({ connected: false });

    const data = await res.json();
    const connected = data?.instance?.state === 'open';

    return NextResponse.json({ connected, state: data?.instance?.state });
  } catch (error: any) {
    console.error('Status check error:', error.message);
    return NextResponse.json({ connected: false, error: error.message });
  }
}
