import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'cromahub';

export async function POST() {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Variáveis de ambiente da Evolution API não configuradas.' }, { status: 500 });
  }

  try {
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
        integration: "WHATSAPP-BAILEYS"
      })
    });

    if (createRes.status === 403) {
      // Instância já existe. Vamos verificar o status
      const stateRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
      });
      const stateData = await stateRes.json();
      
      if (stateData?.instance?.state === 'open') {
        return NextResponse.json({ connected: true });
      }

      // Se tiver 'close', vamos deletar e recriar
      if (stateData?.instance?.state === 'close') {
        await fetch(`${EVOLUTION_API_URL}/instance/delete/${INSTANCE_NAME}`, {
          method: 'DELETE',
          headers: { 'apikey': EVOLUTION_API_KEY }
        });
        
        // Tenta criar de novo
        await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            instanceName: INSTANCE_NAME,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });
      }
    }

    // 2. Conectar e tentar pegar o QR Code com retentativas (pois demora uns segundos)
    for (let i = 0; i < 5; i++) {
      // Espera 1.5s
      await new Promise(resolve => setTimeout(resolve, 1500));
      
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

    return NextResponse.json({ error: 'Timeout ao gerar QR Code. Tente novamente.' }, { status: 400 });

  } catch (error: any) {
    console.error('Evolution Instance Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
