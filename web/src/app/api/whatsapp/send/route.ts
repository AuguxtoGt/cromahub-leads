import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { chat_id, remote_jid, text } = await req.json();

    if (!remote_jid || !text) {
      return NextResponse.json({ error: 'Faltando parâmetros: remote_jid e text são obrigatórios.' }, { status: 400 });
    }

    // Normaliza o número: a Evolution API espera apenas os dígitos
    const number = remote_jid.split('@')[0].replace(/\D/g, '');

    // ── Payload Evolution API v2 ─────────────────────────────────
    // v2 usa "textMessage": { "text": "..." }
    // v1 usa "text": "..."
    // Tentamos v2 primeiro, com fallback para v1
    const payloadV2 = {
      number,
      options: {
        delay: 1200,
        presence: 'composing',
      },
      textMessage: {
        text,
      },
    };

    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify(payloadV2),
      }
    );

    // Se v2 falhar com 422 (Unprocessable Entity), tenta v1
    let data: any = null;
    if (!response.ok && response.status === 422) {
      console.warn('Evolution v2 falhou, tentando payload v1...');
      const payloadV1 = {
        number,
        options: { delay: 1200, presence: 'composing' },
        text,
      };
      const responseV1 = await fetch(
        `${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify(payloadV1),
        }
      );
      if (!responseV1.ok) {
        const err = await responseV1.text();
        console.error('Erro na Evolution API (v1 fallback):', responseV1.status, err);
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
        return NextResponse.json({ error: 'Erro ao enviar mensagem', details: err }, { status: 500 });
      }
      data = await responseV1.json();
    } else if (!response.ok) {
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
    } else {
      data = await response.json();
    }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
