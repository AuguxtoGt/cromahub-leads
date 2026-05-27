import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Evolution API envia POST com os eventos
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Verificamos o tipo de evento (messages.upsert = nova mensagem recebida/enviada)
    if (body.event === 'messages.upsert') {
      const msgData = body.data;
      
      // O Evolution pode mandar mensagens de grupos ou status, vamos filtrar para focar em chats diretos (ou pelo menos garantir que remoteJid existe)
      const remoteJid = msgData.key?.remoteJid;
      const fromMe = msgData.key?.fromMe || false;
      const messageId = msgData.key?.id;
      const pushName = msgData.pushName || 'Desconhecido';
      
      if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
        return NextResponse.json({ success: true, message: 'Ignorado (grupo ou status)' });
      }

      // Extrair o conteúdo de texto da mensagem
      let content = '';
      if (msgData.message?.conversation) {
        content = msgData.message.conversation;
      } else if (msgData.message?.extendedTextMessage?.text) {
        content = msgData.message.extendedTextMessage.text;
      } else if (msgData.message?.imageMessage) {
        content = '📷 Imagem';
      } else if (msgData.message?.audioMessage) {
        content = '🎵 Áudio';
      } else {
        content = '📎 Arquivo/Outro';
      }

      // 1. Encontrar ou criar o chat correspondente
      // Procuramos o chat pelo remoteJid
      let { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('remote_jid', remoteJid)
        .single();

      if (!chat) {
        // Se não existir, vamos tentar encontrar um lead com esse número
        // Limpamos o JID para pegar só o telefone (ex: 5511999999999)
        const phoneDigits = remoteJid.split('@')[0];
        
        // Tenta achar um lead pelo telefone limpo
        const { data: lead } = await supabase
          .from('leads')
          .select('id, name')
          .ilike('phone', `%${phoneDigits.slice(2)}%`) // Busca parcial pelos últimos dígitos
          .limit(1)
          .single();

        // Cria o chat
        const { data: newChat, error: chatError } = await supabase
          .from('whatsapp_chats')
          .insert({
            remote_jid: remoteJid,
            phone: phoneDigits,
            name: lead?.name || pushName,
            lead_id: lead?.id || null,
            last_message_preview: content,
            unread_count: fromMe ? 0 : 1
          })
          .select()
          .single();
          
        if (chatError) console.error("Erro ao criar chat:", chatError);
        chat = newChat;
      } else {
        // Atualiza o chat existente
        await supabase
          .from('whatsapp_chats')
          .update({
            last_message_preview: content,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : (chat.unread_count || 0) + 1,
            name: chat.name === 'Desconhecido' ? pushName : chat.name
          })
          .eq('id', chat.id);
      }

      // 2. Salvar a mensagem
      if (chat) {
        await supabase
          .from('whatsapp_messages')
          .upsert({
            chat_id: chat.id,
            remote_jid: remoteJid,
            message_id: messageId,
            from_me: fromMe,
            content: content,
            status: fromMe ? 'SENT' : 'RECEIVED',
            timestamp: new Date(msgData.messageTimestamp * 1000).toISOString()
          }, { onConflict: 'message_id' });
      }
    }

    // Processar atualização de status (entregue, lida, etc)
    if (body.event === 'messages.update') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];
      
      for (const update of updates) {
        const messageId = update.key?.id;
        let status = 'SENT';
        
        if (update.update?.status === 3) status = 'DELIVERED'; // Entregue
        if (update.update?.status === 4) status = 'READ'; // Lido
        if (update.update?.status === 5) status = 'FAILED';

        if (messageId && status !== 'SENT') {
          await supabase
            .from('whatsapp_messages')
            .update({ status })
            .eq('message_id', messageId);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Webhook Evolution Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
