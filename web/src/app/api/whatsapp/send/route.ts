import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'cromahub';

export async function POST(req: Request) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    return NextResponse.json(
      { error: 'Variáveis de ambiente da Evolution API não configuradas.' },
      { status: 500 }
    );
  }

  try {
    const supabase = await getDbClient(req);
    const { chat_id, remote_jid, text } = await req.json();

    if (!remote_jid || !text) {
      return NextResponse.json({ error: 'Faltando parâmetros: remote_jid e text são obrigatórios.' }, { status: 400 });
    }

    // A Evolution API aceita o JID completo (incluindo @lid ou @g.us) ou apenas os dígitos para @s.whatsapp.net
    // Como o painel nos envia o remote_jid, vamos usá-lo diretamente
    const number = remote_jid;

    // ── Payload Evolution API ─────────────────────────────────
    const payload = {
      number,
      options: {
        delay: 1200,
        presence: 'composing',
      },
      text,
    };

    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Erro na Evolution API (sendText):', response.status, err);
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
