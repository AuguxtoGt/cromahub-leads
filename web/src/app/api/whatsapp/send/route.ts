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
        });
      }
      return NextResponse.json({ error: 'Erro ao enviar mensagem no WhatsApp', details: err }, { status: 500 });
    }

    const data = await response.json();

    // Salva a mensagem imediatamente no banco (otimista, sem esperar webhook)
    if (chat_id) {
      await supabase.from('whatsapp_messages').insert({
        chat_id,
        remote_jid,
        message_id: data?.key?.id || `temp-${Date.now()}`,
        from_me: true,
        content: text,
        media_type: 'TEXT',
        status: 'PENDING',
      });

      await supabase
        .from('whatsapp_chats')
        .update({
          last_message_preview: text,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', chat_id);
    }

    return NextResponse.json({ success: true, message_id: data?.key?.id });
  } catch (error: any) {
    console.error('Send Message Error:', error);
    return NextResponse.json({ error: 'Erro interno ao enviar a mensagem' }, { status: 500 });
  }
}
