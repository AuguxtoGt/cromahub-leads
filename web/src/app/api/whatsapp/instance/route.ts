import { NextResponse } from 'next/server';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'https://api.cromahub.cloud';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'CromaHubSuperSecretKey2026';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'cromahub';

export async function POST() {
  try {
    // 1. Tentar criar a instância (se já existir ele retorna erro, mas tudo bem)
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

    // 2. Conectar na instância e pegar o QR Code em Base64
    const response = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
      method: 'GET',
      headers: {
        'apikey': EVOLUTION_API_KEY
      }
    });

    const data = await response.json();

    if (data.base64) {
      return NextResponse.json({ qrcode: data.base64 });
    }

    // Se não tiver base64 na resposta, pode ser que já esteja conectado
    if (data.instance?.state === 'open') {
      return NextResponse.json({ connected: true });
    }

    return NextResponse.json({ error: 'Não foi possível gerar o QR Code' }, { status: 400 });

  } catch (error: any) {
    console.error('Evolution Instance Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
