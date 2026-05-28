import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
// Normaliza qualquer formato de JID para apenas dígitos do número
// Ex: "5511999999999@s.whatsapp.net" → "5511999999999"
//     "123456789@lid"               → "123456789"
// ─────────────────────────────────────────────────────────────
function normalizePhone(jid: string): string {
  return jid.split('@')[0].replace(/\D/g, '');
}

// ─────────────────────────────────────────────────────────────
// Encontra ou cria um chat, sempre usando phone como chave
// (funciona com ou sem a coluna phone_normalized na tabela)
// ─────────────────────────────────────────────────────────────
async function findOrCreateChat(
  remoteJid: string,
  pushName: string,
  fromMe: boolean,
  content: string
) {
  const phoneNormalized = normalizePhone(remoteJid);
  if (!phoneNormalized) return null;

  // 1ª tentativa: busca por phone_normalized (funciona após migration)
  let { data: chat, error: findError } = await supabase
    .from('whatsapp_chats')
    .select('*')
    .eq('phone_normalized', phoneNormalized)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Se a coluna phone_normalized não existir ainda, busca pelo phone
  if (findError && findError.message?.includes('phone_normalized')) {
    const res = await supabase
      .from('whatsapp_chats')
      .select('*')
      .eq('phone', phoneNormalized)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    chat = res.data;

    // Se não encontrou pelo phone, tenta pelo remote_jid
    if (!chat) {
      const res2 = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('remote_jid', remoteJid)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      chat = res2.data;
    }
  }

  const previewText = content.startsWith('[AUDIO]') ? '🎵 Áudio' : content.startsWith('[IMAGE]') ? '📷 Imagem' : content;

  if (!chat) {
    // Tenta achar o lead pelo número
    const { data: lead } = await supabase
      .from('leads')
      .select('id, name')
      .ilike('phone', `%${phoneNormalized.slice(-9)}%`)
      .limit(1)
      .maybeSingle();

    // Monta o payload de insert (resiliente: inclui phone_normalized se possível)
    const insertPayload: Record<string, any> = {
      remote_jid: remoteJid,
      phone: phoneNormalized,
      phone_normalized: phoneNormalized, // aceito silenciosamente se a coluna não existir
      name: lead?.name || pushName || phoneNormalized,
      lead_id: lead?.id || null,
      last_message_preview: previewText,
      last_message_at: new Date().toISOString(),
      unread_count: fromMe ? 0 : 1,
    };

    const { data: newChat, error: chatError } = await supabase
      .from('whatsapp_chats')
      .insert(insertPayload)
      .select()
      .single();

    if (chatError) {
      // Conflito de UNIQUE (race condition ou duplicata) — busca novamente
      if (chatError.code === '23505') {
        const { data: existingChat } = await supabase
          .from('whatsapp_chats')
          .select('*')
          .eq('phone', phoneNormalized)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return existingChat;
      }

      // Se phone_normalized causou erro de coluna inexistente, tenta sem ela
      if (chatError.message?.includes('phone_normalized')) {
        delete insertPayload.phone_normalized;
        const { data: fallbackChat } = await supabase
          .from('whatsapp_chats')
          .insert(insertPayload)
          .select()
          .single();
        return fallbackChat;
      }

      console.error('Erro ao criar chat:', chatError);
      return null;
    }
    return newChat;
  }

  // Atualiza o chat existente
  const updatePayload: Record<string, any> = {
    last_message_preview: previewText,
    last_message_at: new Date().toISOString(),
    unread_count: fromMe ? 0 : (chat.unread_count || 0) + 1,
    name:
      chat.name === 'Desconhecido' || !chat.name
        ? pushName || chat.name
        : chat.name,
  };

  // Atualiza o remote_jid se vier em formato mais estável
  if (remoteJid.includes('@s.whatsapp.net')) {
    updatePayload.remote_jid = remoteJid;
  }

  await supabase
    .from('whatsapp_chats')
    .update(updatePayload)
    .eq('id', chat.id);

  return { ...chat };
}

// ─────────────────────────────────────────────────────────────
// Extrai o conteúdo da mensagem, incluindo áudio em Base64
// ─────────────────────────────────────────────────────────────
function extractMessageContent(msgData: any): {
  content: string;
  mediaType: string;
} {
  const msg = msgData.message;

  if (!msg) return { content: '📎 Mensagem vazia', mediaType: 'TEXT' };

  if (msg.conversation) {
    return { content: msg.conversation, mediaType: 'TEXT' };
  }

  if (msg.extendedTextMessage?.text) {
    return { content: msg.extendedTextMessage.text, mediaType: 'TEXT' };
  }

  if (msg.imageMessage) {
    const base64 = msg.imageMessage?.base64 || msg.imageMessage?.jpegThumbnail;
    if (base64) {
      return {
        content: `[IMAGE] data:image/jpeg;base64,${base64}`,
        mediaType: 'IMAGE',
      };
    }
    return { content: '📷 Imagem', mediaType: 'IMAGE' };
  }

  // ─── ÁUDIO: extrai Base64 e monta data URL para o player ───────
  if (msg.audioMessage) {
    const base64 =
      msg.audioMessage?.base64 ||
      msgData.base64 ||
      null;

    if (base64) {
      const mimeType =
        msg.audioMessage?.mimetype || 'audio/ogg; codecs=opus';
      return {
        content: `[AUDIO] data:${mimeType};base64,${base64}`,
        mediaType: 'AUDIO',
      };
    }
    return { content: '🎵 Áudio (sem dados)', mediaType: 'AUDIO' };
  }

  if (msg.documentMessage) {
    return {
      content: `📄 ${msg.documentMessage.fileName || 'Documento'}`,
      mediaType: 'FILE',
    };
  }

  if (msg.videoMessage) {
    return { content: '🎬 Vídeo', mediaType: 'VIDEO' };
  }

  if (msg.stickerMessage) {
    return { content: '🎨 Figurinha', mediaType: 'TEXT' };
  }

  if (msg.reactionMessage) {
    return {
      content: `${msg.reactionMessage.text || '👍'} (reação)`,
      mediaType: 'TEXT',
    };
  }

  return { content: '📎 Arquivo/Outro', mediaType: 'FILE' };
}

// ─────────────────────────────────────────────────────────────
// Salva mensagem no banco (evita sobrescrever áudio existente com fallback)
// ─────────────────────────────────────────────────────────────
async function saveMessage(
  chatId: string,
  remoteJid: string,
  messageId: string,
  fromMe: boolean,
  content: string,
  mediaType: string,
  status: string,
  timestamp: number
) {
  // Verifica se a mensagem já existe (para evitar perder o Base64 em caso de webhook duplicado)
  const { data: existingMsg } = await supabase
    .from('whatsapp_messages')
    .select('id, content')
    .eq('message_id', messageId)
    .maybeSingle();

  if (existingMsg) {
    // Se a mensagem já existe, só atualiza o status.
    // MAS se a mensagem existente tinha um placeholder e agora chegou o Base64 real, atualizamos o conteúdo.
    const updatePayload: Record<string, any> = { status };
    
    if (content.startsWith('[AUDIO] data:') && !existingMsg.content?.startsWith('[AUDIO] data:')) {
      updatePayload.content = content;
      updatePayload.media_type = mediaType;
    } else if (content !== '🎵 Áudio (sem dados)' && content !== '📎 Mensagem vazia' && existingMsg.content === '🎵 Áudio (sem dados)') {
      updatePayload.content = content;
      updatePayload.media_type = mediaType;
    }

    await supabase
      .from('whatsapp_messages')
      .update(updatePayload)
      .eq('message_id', messageId);
      
    return;
  }

  // Se a mensagem é nova, insere no banco
  const msgPayload: Record<string, any> = {
    chat_id: chatId,
    remote_jid: remoteJid,
    message_id: messageId,
    from_me: fromMe,
    content,
    media_type: mediaType,
    status,
    timestamp: new Date(timestamp * 1000).toISOString(),
  };

  const { error } = await supabase
    .from('whatsapp_messages')
    .insert(msgPayload);

  // Se media_type não existir como coluna (migration pendente), tenta sem ela
  if (error?.message?.includes('media_type')) {
    delete msgPayload.media_type;
    await supabase
      .from('whatsapp_messages')
      .insert(msgPayload);
  }
}

// ─────────────────────────────────────────────────────────────
// Handler principal do Webhook da Evolution API
// ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── Evento: nova mensagem recebida ou enviada pelo painel ────
    if (body.event === 'messages.upsert') {
      const msgData = body.data;
      const rawRemoteJid = msgData.key?.remoteJid;
      const fromMe = msgData.key?.fromMe || false;
      const messageId = msgData.key?.id;
      const pushName = msgData.pushName || '';

      // Resolve LID para o número real (se disponível no payload da Evolution)
      let realJid = rawRemoteJid;
      if (rawRemoteJid && rawRemoteJid.includes('@lid')) {
        if (msgData.key?.senderPn) {
          realJid = msgData.key.senderPn;
        } else if (msgData.message?.senderKeyDistributionMessage?.groupId) {
          // Fallbacks de payload que podem conter o número
          realJid = msgData.message.senderKeyDistributionMessage.groupId;
        }
      }

      // Filtra grupos e broadcasts
      if (
        !realJid ||
        realJid.includes('@g.us') ||
        realJid === 'status@broadcast'
      ) {
        return NextResponse.json({
          success: true,
          message: 'Ignorado (grupo ou status)',
        });
      }

      const { content, mediaType } = extractMessageContent(msgData);
      
      // Envia rawRemoteJid como remoteJid para o findOrCreateChat, MAS usa realJid para phone_normalized
      // Espera aí, no saveMessage precisamos do remoteJid real da sessão do whatsapp para responder
      // Vamos passar o realJid para evitar duplicação, mas o rawRemoteJid para o banco se for LID?
      // O sendMessage aceita o rawRemoteJid (@lid).
      const chat = await findOrCreateChat(realJid, pushName, fromMe, content);

      if (chat) {
        // Se a gente resolveu o LID, atualizamos o remote_jid para o raw (o LID) para garantir que podemos responder?
        // Ou atualizamos o LID no banco?
        // A evolution aceita tanto o senderPn quanto o LID para enviar. Mas LID é mais seguro na mesma sessão.
        if (rawRemoteJid.includes('@lid')) {
           // update silent para sempre ter o jid correto para responder
           await supabase.from('whatsapp_chats').update({ remote_jid: rawRemoteJid }).eq('id', chat.id);
        }

        await saveMessage(
          chat.id,
          rawRemoteJid,
          messageId,
          fromMe,
          content,
          mediaType,
          fromMe ? 'SENT' : 'RECEIVED',
          msgData.messageTimestamp || Math.floor(Date.now() / 1000)
        );

        // Freio de mão: cliente respondeu → para follow-up automático
        if (!fromMe && chat.lead_id) {
          await supabase
            .from('leads')
            .update({ status_pipeline: 'REPLIED' })
            .eq('id', chat.lead_id);
        }
      }
    }

    // ── Evento: mensagem ENVIADA pelo n8n ou API externa ────────
    if (body.event === 'send.message') {
      const msgData = body.data;
      const rawRemoteJid = msgData.key?.remoteJid;
      const messageId = msgData.key?.id;

      // Resolve LID para o número real
      let realJid = rawRemoteJid;
      if (rawRemoteJid && rawRemoteJid.includes('@lid')) {
        if (msgData.key?.senderPn) {
          realJid = msgData.key.senderPn;
        } else if (msgData.message?.senderKeyDistributionMessage?.groupId) {
          realJid = msgData.message.senderKeyDistributionMessage.groupId;
        }
      }

      if (
        !realJid ||
        realJid.includes('@g.us') ||
        realJid === 'status@broadcast'
      ) {
        return NextResponse.json({ success: true, message: 'Ignorado' });
      }

      const { content, mediaType } = extractMessageContent(msgData);
      const chat = await findOrCreateChat(realJid, '', true, content);

      if (chat) {
        if (rawRemoteJid.includes('@lid')) {
           await supabase.from('whatsapp_chats').update({ remote_jid: rawRemoteJid }).eq('id', chat.id);
        }
        await saveMessage(
          chat.id,
          rawRemoteJid,
          messageId,
          true,
          content,
          mediaType,
          'SENT',
          msgData.messageTimestamp || Math.floor(Date.now() / 1000)
        );
      }
    }

    // ── Evento: atualização de status (entregue, lido, falhou) ──
    if (body.event === 'messages.update') {
      const updates = Array.isArray(body.data) ? body.data : [body.data];

      for (const update of updates) {
        const messageId = update.key?.id;
        let status = '';

        if (update.update?.status === 2) status = 'SENT';
        if (update.update?.status === 3) status = 'DELIVERED';
        if (update.update?.status === 4) status = 'READ';
        if (update.update?.status === 5) status = 'FAILED';

        if (messageId && status) {
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
