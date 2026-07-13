import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// ─── GET: só verifica o estado da instância, sem criar nada ─────────────────
// Usado pelo checkConnection inicial da página para não bloquear o carregamento.
export async function GET(req: Request) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json({ connected: false, reason: 'config_missing' });
  }

  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ connected: false, reason: 'auth' });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
      headers: { 'apikey': EVOLUTION_API_KEY },
      signal: AbortSignal.timeout(5000),
    });

    if (!stateRes.ok) {
      // 404 = instância ainda não existe, não é erro
      return NextResponse.json({ connected: false, reason: 'not_created' });
    }

    const stateData = await stateRes.json();
    const connected = stateData?.instance?.state === 'open';
    return NextResponse.json({ connected, state: stateData?.instance?.state });
  } catch (error: any) {
    console.error('Instance GET error:', error.message);
    return NextResponse.json({ connected: false, reason: 'error' });
  }
}

// ─── POST: cria a instância (se necessário) e gera o QR Code ────────────────
export async function POST(req: Request) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Variáveis de ambiente da Evolution API não configuradas.' }, { status: 500 });
  }

  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    // 1. Tentar criar a instância
    const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        instanceName: INSTANCE_NAME,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          enabled: true,
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://leads.cromahub.cloud'}/api/webhooks/evolution`,
          byEvents: false,
          base64: true,
          events: ["MESSAGES_UPSERT", "SEND_MESSAGE", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
        }
      })
    });

    // 403 = instância já existe
    if (createRes.status === 403) {
      const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      const stateData = await stateRes.json();

      if (stateData?.instance?.state === 'open') {
        return NextResponse.json({ connected: true });
      }
      // Se 'close', cai no loop de connect abaixo para gerar novo QR
    }

    // 2. Conectar e tentar pegar o QR Code com retentativas
    // A Evolution API demora alguns segundos para gerar o QR após o create
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
        method: 'GET',
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      const data = await response.json();

      if (data.base64) {
        return NextResponse.json({ qrcode: data.base64 });
      }
      if (data.instance?.state === 'open') {
        return NextResponse.json({ connected: true });
      }
    }

    return NextResponse.json({ error: 'Timeout ao gerar QR Code. Tente novamente.' }, { status: 408 });

  } catch (error: any) {
    console.error('Evolution Instance Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: faz logout e deleta a instância ─────────────────────────────────
export async function DELETE(req: Request) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Configurações ausentes' }, { status: 500 });
  }

  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    // 1. Logout primeiro para limpar a sessão
    await fetch(`${EVOLUTION_API_URL}/instance/logout/${INSTANCE_NAME}`, {
      method: 'DELETE',
      headers: { 'apikey': EVOLUTION_API_KEY }
    });

    // 2. Deletar a instância completamente
    await fetch(`${EVOLUTION_API_URL}/instance/delete/${INSTANCE_NAME}`, {
      method: 'DELETE',
      headers: { 'apikey': EVOLUTION_API_KEY }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Force Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
