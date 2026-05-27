import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validar se é um evento da Evolution API
    if (!body || !body.event) {
      return NextResponse.json({ success: true });
    }

    // Apenas mensagens novas nos importam
    if (body.event === 'messages.upsert') {
      const data = body.data;
      
      // Alguns webhooks mandam array, outros mandam objeto direto
      const msg = Array.isArray(data.messages) ? data.messages[0] : (data.message || data);
      
      if (!msg || !msg.key || !msg.key.remoteJid) {
        return NextResponse.json({ success: true });
      }

      // Ignorar status do WhatsApp
      if (msg.key.remoteJid === 'status@broadcast') {
        return NextResponse.json({ success: true });
      }

      const remoteJid = msg.key.remoteJid;
      const phone = remoteJid.split('@')[0];
      const fromMe = msg.key.fromMe;
      const messageId = msg.key.id;
      const pushName = msg.pushName || phone;
      
      // Extrair o conteúdo da mensagem (pode vir em vários formatos)
      const content = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      msg.message?.imageMessage?.caption || 
                      "[Mídia/Arquivo]";
      
      const timestamp = msg.messageTimestamp 
        ? new Date(msg.messageTimestamp * 1000).toISOString() 
        : new Date().toISOString();

      // 1. Procurar ou criar o chat
      let { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('remote_jid', remoteJid)
        .single();

      if (!chat) {
        // Tentar achar um lead correspondente pelo número
        const { data: lead } = await supabase
          .from('leads')
          .select('id, name')
          .like('phone', `%${phone.substring(2)}%`) // Busca pelo número sem código do país
          .single();

        const { data: newChat } = await supabase
          .from('whatsapp_chats')
          .insert({
            remote_jid: remoteJid,
            phone: phone,
            name: lead ? lead.name : pushName,
            lead_id: lead ? lead.id : null,
            last_message_preview: content,
            last_message_at: timestamp,
            unread_count: fromMe ? 0 : 1,
            chat_status: fromMe ? 'UNANSWERED' : 'ANSWERED'
          })
          .select()
          .single();
          
        chat = newChat;
      } else {
        // Atualizar o chat existente
        await supabase
          .from('whatsapp_chats')
          .update({
            last_message_preview: content,
            last_message_at: timestamp,
            unread_count: fromMe ? 0 : chat.unread_count + 1,
            // Se o cliente respondeu, muda pra ANSWERED
            chat_status: !fromMe ? 'ANSWERED' : chat.chat_status
          })
          .eq('id', chat.id);
      }

      // 2. Salvar a mensagem
      if (chat) {
        await supabase
          .from('whatsapp_messages')
          .insert({
            chat_id: chat.id,
            remote_jid: remoteJid,
            message_id: messageId,
            from_me: fromMe,
            content: content,
            status: fromMe ? 'SENT' : 'RECEIVED',
            timestamp: timestamp
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
