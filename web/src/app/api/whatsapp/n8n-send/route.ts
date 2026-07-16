import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { z } from 'zod';

const schema = z.object({
  lead_id: z.string().uuid(),
  text: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    // Validação de autenticação via Bearer token (o mesmo usado pelo n8n)
    const authHeader = req.headers.get('authorization');
    const secretKey = process.env.CRON_SECRET;

    if (!secretKey) {
      console.error('CRÍTICO: CRON_SECRET não configurada no ambiente.');
      return NextResponse.json({ error: 'Configuração de servidor inválida' }, { status: 500 });
    }
    
    if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.format() }, { status: 400 });
    }

    const { lead_id, text } = parsed.data;

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
    
    // Formatar o telefone — somente dígitos, com DDI 55
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    // ── PASSO 1: Verificar o número real no WhatsApp ──────────────────────
    // A WAHA/NOWEB aceita números errados sem reclamar (retorna 201),
    // mas a mensagem nunca chega. Precisamos resolver o chatId real.
    let chatId = `${phoneWithDDI}@c.us`;
    
    try {
      const checkRes = await fetch(
        `${WAHA_API_URL}/api/contacts/check-exists?phone=${phoneWithDDI}&session=${sessionName}`,
        {
          headers: {
            'X-Api-Key': WAHA_API_KEY,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.numberExists && checkData.chatId) {
          chatId = checkData.chatId;
          console.log(`[WAHA] Número ${phoneWithDDI} resolvido para chatId: ${chatId}`);
        } else {
          console.warn(`[WAHA] Número ${phoneWithDDI} NÃO existe no WhatsApp. Abortando envio.`);
          return NextResponse.json({ 
            error: 'Phone number not registered on WhatsApp',
            phone: phoneWithDDI,
          }, { status: 422 });
        }
      } else {
        console.warn(`[WAHA] check-exists retornou ${checkRes.status}, usando chatId padrão: ${chatId}`);
      }
    } catch (checkErr: any) {
      console.warn(`[WAHA] Falha no check-exists (${checkErr.message}), usando chatId padrão: ${chatId}`);
    }

    // ── PASSO 2: Enviar mensagem para WAHA com o chatId correto ──────────
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
      return NextResponse.json({ error: 'Failed to send message via WAHA', details: errorData }, { status: response.status });
    }

    const responseData = await response.json().catch(() => ({}));
    console.log(`[WAHA] ✅ Message sent to ${chatId}:`, JSON.stringify(responseData).substring(0, 200));

    return NextResponse.json({ success: true, message: 'Message sent via WAHA', chatId });

  } catch (error: any) {
    console.error('N8N Send Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
