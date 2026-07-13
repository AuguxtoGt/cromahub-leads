import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://api.cromahub.cloud';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://leads.cromahub.cloud';

// ─── GET: verifica o estado da instância ─────────────────
export async function GET(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ connected: false, reason: 'auth' });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    const stateRes = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}`, {
      headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!stateRes.ok) {
      return NextResponse.json({ connected: false, reason: 'not_created' });
    }

    const stateData = await stateRes.json();
    const connected = stateData?.status === 'WORKING';
    return NextResponse.json({ connected, state: stateData?.status });
  } catch (error: any) {
    console.error('Instance GET error:', error.message);
    return NextResponse.json({ connected: false, reason: 'error' });
  }
}

// ─── POST: cria a instância e gera o QR Code ────────────────
export async function POST(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    // 1. Tentar criar a sessão na WAHA
    const createPayload = {
      name: INSTANCE_NAME,
      config: {
        webhooks: [
          {
            url: `${APP_URL}/api/webhooks/waha`,
            events: ["message", "session.status"],
            hmac: null
          }
        ]
      }
    };
    
    console.log(`[WAHA] Criando sessao ${INSTANCE_NAME}...`, JSON.stringify(createPayload));

    const createRes = await fetch(`${WAHA_API_URL}/api/sessions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify(createPayload)
    });

    const createText = await createRes.text();
    console.log(`[WAHA] Resposta criacao (${createRes.status}):`, createText);

    if (createRes.status === 422 || createText.includes('already exists')) {
      console.log(`[WAHA] Sessão já existe. Tentando iniciar/retomar...`);
      const startRes = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}/start`, {
        method: 'POST',
        headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
      });
      console.log(`[WAHA] Resposta start (${startRes.status})`);
    }

    // 2. Tentar pegar o QR Code com retentativas
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 20 * 3s = 60s max
      console.log(`[WAHA] Tentativa ${i+1}/20 de obter o QR code...`);

      const response = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}/auth/qr`, {
        method: 'GET',
        headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
      });
      
      const textResponse = await response.text();
      
      try {
        const data = JSON.parse(textResponse);
        if (data && data.qr) {
          // WAHA envia o QR apenas em string, às vezes precisa gerar imagem.
        }
      } catch (e) {
        // Ignorar
      }
      
      // A forma mais segura de pegar imagem na WAHA:
      const imgRes = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}/auth/qr?format=image`, {
        method: 'GET',
        headers: { 'X-Api-Key': WAHA_API_KEY }
      });
      
      if (imgRes.ok && imgRes.headers.get('content-type')?.includes('image')) {
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        console.log(`[WAHA] QR code obtido com sucesso!`);
        return NextResponse.json({ qrcode: `data:image/png;base64,${base64}` });
      }

      // Verifica se já conectou
      const stateRes = await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}`, {
        headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
      });
      if (stateRes.ok) {
         const stateData = await stateRes.json();
         if (stateData?.status === 'WORKING') {
           console.log(`[WAHA] Sessao ja conectada (WORKING).`);
           return NextResponse.json({ connected: true });
         }
      }
    }

    return NextResponse.json({ error: 'Timeout ao gerar QR Code. Tente novamente.' }, { status: 408 });

  } catch (error: any) {
    console.error('WAHA Instance Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── DELETE: deleta a instância ─────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;

    // 1. Logout
    await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}/logout`, {
      method: 'POST',
      headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
    });

    // 2. Parar e Deletar a sessão
    await fetch(`${WAHA_API_URL}/api/sessions/${INSTANCE_NAME}/stop`, {
      method: 'POST',
      headers: { 'X-Api-Key': WAHA_API_KEY, 'Accept': 'application/json' }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Force Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
