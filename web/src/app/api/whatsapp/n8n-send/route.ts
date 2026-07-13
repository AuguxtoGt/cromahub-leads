import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    // Validação de autenticação via Bearer token (o mesmo usado pelo n8n)
    const authHeader = req.headers.get('authorization');
    const secretKey = process.env.CRON_SECRET || 'crhm-leads-sec-9a8b7c6d5e4f3g2h1';
    
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lead_id, text } = await req.json();

    if (!lead_id || !text) {
      return NextResponse.json({ error: 'Missing lead_id or text' }, { status: 400 });
    }

    // Buscar o lead no banco para descobrir o user_id (dono) e o telefone
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, user_id, phone')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.phone) {
      return NextResponse.json({ error: 'Lead has no phone' }, { status: 400 });
    }

    const WAHA_API_URL = process.env.WAHA_API_URL || 'https://api.cromahub.cloud';
    const WAHA_API_KEY = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';
    
    // O nome da sessão é padronizado por tenant
    const sessionName = `cromahub-${lead.user_id}`;
    
    // Formatar o telefone para o formato WAHA (somente números seguido de @c.us)
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const chatId = `55${cleanPhone}@c.us`; // Assumindo Brasil (55)

    // Enviar mensagem para WAHA
    const response = await fetch(`${WAHA_API_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        session: sessionName,
        chatId: chatId,
        text: text
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[WAHA] Error sending message to ${chatId} via session ${sessionName}:`, errorData);
      return NextResponse.json({ error: 'Failed to send message via WAHA' }, { status: response.status });
    }

    return NextResponse.json({ success: true, message: 'Message queued in WAHA' });

  } catch (error: any) {
    console.error('N8N Send Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
