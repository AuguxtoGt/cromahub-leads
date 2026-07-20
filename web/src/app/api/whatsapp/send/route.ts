import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';
import { z } from 'zod';


const schema = z.object({
  chat_id: z.string().uuid().nullable().optional(),
  remote_jid: z.string().min(1),
  text: z.string().min(1),
});

const WAHA_API_URL = process.env.WAHA_API_URL || 'https://api.cromahub.cloud';
const WAHA_API_KEY = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';

export async function POST(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    const INSTANCE_NAME = `cromahub-${user.id}`;
    
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.format() }, { status: 400 });
    }

    const { chat_id, remote_jid, text } = parsed.data;

    let chatId = remote_jid;
    if (chatId.includes('@s.whatsapp.net')) {
      chatId = chatId.replace('@s.whatsapp.net', '@c.us');
    } else if (!chatId.includes('@')) {
      chatId = `${chatId}@c.us`;
    }

    // Se for um JID de dispositivo vinculado (@lid), buscamos o telefone da conversa para resolver no WAHA
    if (chatId.endsWith('@lid') && chat_id) {
      const { data: chatData } = await supabase
        .from('whatsapp_chats')
        .select('phone')
        .eq('id', chat_id)
        .single();
      
      if (chatData?.phone) {
        const cleanPhone = chatData.phone.replace(/\D/g, '');
        const phoneWithDDI = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        chatId = `${phoneWithDDI}@c.us`;
      }
    }

    // ── PASSO 1: Verificar o número real no WhatsApp ──────────────────────
    try {
      const checkRes = await fetch(
        `${WAHA_API_URL}/api/contacts/check-exists?phone=${chatId.split('@')[0]}&session=${INSTANCE_NAME}`,
        {
          headers: {
            'X-Api-Key': WAHA_API_KEY,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.numberExists && checkData.chatId) {
          chatId = checkData.chatId;
        } else {
          return NextResponse.json({ error: 'Número de telefone não existe no WhatsApp' }, { status: 400 });
        }
      }
    } catch (e) {
      // Falha silenciosa, continua com o chatId original
      console.warn('[WAHA] check-exists falhou no send:', e);
    }

    // ── Payload WAHA API ─────────────────────────────────
    const payload = {
      session: INSTANCE_NAME,
      chatId: chatId,
      text: text,
    };

    const response = await fetch(`${WAHA_API_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Erro na WAHA API (sendText):', response.status, err);
      if (chat_id) {
        await supabase.from('whatsapp_messages').insert({
          chat_id,
          remote_jid,
          message_id: `err-${Date.now()}`,
          from_me: true,
          content: `❌ ERRO AO ENVIAR: ${err.substring(0, 100)}`,
          media_type: 'TEXT',
          status: 'FAILED',
          user_id: user.id,
        });
      }
      return NextResponse.json({ error: 'Erro ao enviar mensagem no WhatsApp', details: err }, { status: 500 });
    }

    const data = await response.json();
    const messageId = data?.id || data?.key?.id || `temp-${Date.now()}`;

    // Salva a mensagem imediatamente no banco (status SENT pois a WAHA já aceitou e enviou)
    if (chat_id) {
      await supabase.from('whatsapp_messages').insert({
        chat_id,
        remote_jid,
        message_id: messageId,
        from_me: true,
        content: text,
        media_type: 'TEXT',
        status: 'SENT',
        user_id: user.id,
      });

      await supabase
        .from('whatsapp_chats')
        .update({
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', chat_id);
    }

    return NextResponse.json({ success: true, message_id: messageId });
  } catch (error: any) {
    console.error('Send Message Error:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar a mensagem' }, { status: 500 });
  }
}
