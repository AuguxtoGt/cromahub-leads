import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Substitua pelas variáveis de ambiente no Coolify
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'minha-chave-secreta';
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'cromahub';

export async function POST(req: Request) {
  try {
    const { chat_id, remote_jid, text } = await req.json();

    if (!remote_jid || !text) {
      return NextResponse.json({ error: 'Faltando parâmetros' }, { status: 400 });
    }

    // Chama a Evolution API para enviar
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: remote_jid,
        options: {
          delay: 1200,
          presence: "composing", // Mostra "digitando..."
        },
        textMessage: {
          text: text
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Erro na Evolution API:', err);
      return NextResponse.json({ error: 'Erro ao enviar mensagem no WhatsApp' }, { status: 500 });
    }

    const data = await response.json();
    
    // Sucesso! A mensagem enviada já vai cair no nosso Webhook também (messages.upsert fromMe=true)
    // Então não precisamos salvar no Supabase aqui obrigatoriamente, o webhook fará isso.
    // Mas para garantir resposta rápida na UI, podemos salvar como PENDING.
    
    // Se quiser salvar imediatamente:
    if (chat_id) {
      await supabase.from('whatsapp_messages').insert({
        chat_id,
        remote_jid,
        message_id: data.key?.id || `temp-${Date.now()}`,
        from_me: true,
        content: text,
        status: 'PENDING'
      });
      
      // Atualiza o chat
      await supabase.from('whatsapp_chats').update({
        last_message_preview: text,
        last_message_at: new Date().toISOString()
      }).eq('id', chat_id);
    }

    return NextResponse.json({ success: true, message_id: data.key?.id });

  } catch (error: any) {
    console.error('Send Message Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
