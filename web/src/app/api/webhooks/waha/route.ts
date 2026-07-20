import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// ─────────────────────────────────────────────────────────────
// Normaliza qualquer formato de JID para apenas dígitos do número
// Ex: "5511999999999@c.us" → "5511999999999"
// ─────────────────────────────────────────────────────────────
function normalizePhone(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0].replace(/\D/g, '');
}

async function findOrCreateChat(
  remoteJid: string,
  pushName: string,
  fromMe: boolean,
  content: string,
  userId: string | null
) {
  const phoneNormalized = normalizePhone(remoteJid);
  if (!phoneNormalized) return null;

  let phoneCore = phoneNormalized;
  if (phoneNormalized.startsWith('55') && (phoneNormalized.length === 12 || phoneNormalized.length === 13)) {
    const ddd = phoneNormalized.substring(2, 4);
    const last8 = phoneNormalized.slice(-8);
    phoneCore = `%55${ddd}%${last8}`;
  } else if (phoneNormalized.length > 5) {
    phoneCore = `%${phoneNormalized}`;
  }

  let query = supabase
    .from('whatsapp_chats')
    .select('*')
    .ilike('phone_normalized', phoneCore)
    .order('last_message_at', { ascending: false })
    .limit(1);

  if (userId) query = query.eq('user_id', userId);

  let { data: chat } = await query.maybeSingle();

  if (!chat && remoteJid) {
    let query3 = supabase
      .from('whatsapp_chats')
      .select('*')
      .eq('remote_jid', remoteJid)
      .order('last_message_at', { ascending: false })
      .limit(1);
      
    if (userId) query3 = query3.eq('user_id', userId);
    const res = await query3.maybeSingle();
    chat = res.data;
  }

  const previewText = content.startsWith('[AUDIO]') ? '🎵 Áudio' : content.startsWith('[IMAGE]') ? '📷 Imagem' : content;

  if (!chat) {
    let queryLead = supabase
      .from('leads')
      .select('id, name')
      .ilike('phone', `%${phoneNormalized.slice(-9)}%`)
      .limit(1);
      
    if (userId) queryLead = queryLead.eq('user_id', userId);
    const { data: lead } = await queryLead.maybeSingle();

    const insertPayload: Record<string, any> = {
      remote_jid: remoteJid,
      phone: phoneNormalized,
      phone_normalized: phoneNormalized,
      name: lead?.name || pushName || phoneNormalized,
      last_message_preview: previewText,
      last_message_at: new Date().toISOString(),
      unread_count: fromMe ? 0 : 1,
      chat_status: 'UNANSWERED',
      lead_id: lead?.id || null,
    };
    if (userId) insertPayload.user_id = userId;

    const { data: newChat } = await supabase
      .from('whatsapp_chats')
      .insert(insertPayload)
      .select()
      .single();

    return newChat;
  }

  const updatePayload: Record<string, any> = {
    last_message_preview: previewText,
    last_message_at: new Date().toISOString(),
    unread_count: fromMe ? 0 : (chat.unread_count || 0) + 1,
    name: chat.name === 'Desconhecido' || !chat.name ? pushName || chat.name : chat.name,
    remote_jid: remoteJid
  };

  await supabase
    .from('whatsapp_chats')
    .update(updatePayload)
    .eq('id', chat.id);

  return { ...chat };
}

async function saveMessage(
  chatId: string,
  remoteJid: string,
  messageId: string,
  fromMe: boolean,
  content: string,
  mediaType: string,
  status: string,
  timestamp: number,
  userId: string | null = null
) {
  const { data: existingMsg } = await supabase
    .from('whatsapp_messages')
    .select('id, content')
    .eq('message_id', messageId)
    .maybeSingle();

  if (existingMsg) {
    const updatePayload: Record<string, any> = { status };
    if (content.startsWith('[AUDIO] data:') && !existingMsg.content?.startsWith('[AUDIO] data:')) {
      updatePayload.content = content;
      updatePayload.media_type = mediaType;
    }
    await supabase.from('whatsapp_messages').update(updatePayload).eq('message_id', messageId);
    return;
  }

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
  if (userId) msgPayload.user_id = userId;

  await supabase
    .from('whatsapp_messages')
    .insert(msgPayload);
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const wahaKey = process.env.WAHA_API_KEY || 'CromaHubWahaKey2026';

    if (!token || token !== wahaKey) {
      console.warn('[Webhook WAHA] FALHA DE AUTENTICAÇÃO: Token ausente ou inválido.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[Webhook WAHA] Event:', body.event, 'Session:', body.session);

    // Identifica o user_id baseado na sessão
    const userId = body.session ? body.session.replace('cromahub-', '') : null;

    // ── Evento: Status da Sessão ────────
    if (body.event === 'session.status') {
      const state = body.payload?.status === 'WORKING' ? 'open' : 'close';
      if (userId) {
        await supabase
          .from('settings')
          .update({
            whatsapp_status: state,
            whatsapp_status_updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
      return NextResponse.json({ success: true });
    }

    // ── Evento: Mensagem ────────
    if (body.event === 'message' || body.event === 'message.any') {
      const msg = body.payload;
      const remoteJid = msg.fromMe ? msg.to : msg.from;
      
      // Ignorar status e grupos
      if (!remoteJid || remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') {
        return NextResponse.json({ success: true, message: 'Ignored' });
      }

      let content = msg.body || '📎 Arquivo/Outro';
      let mediaType = 'TEXT';

      // Tratamento básico de mídia, a WAHA pode enviar hasMedia=true.
      // Se necessário, fazer fetch da mídia da WAHA API depois
      if (msg.hasMedia) {
        mediaType = msg.type === 'audio' || msg.type === 'ptt' ? 'AUDIO' : 'IMAGE';
        content = mediaType === 'AUDIO' ? '🎵 Áudio' : '📷 Mídia';
      }

      const chat = await findOrCreateChat(remoteJid, msg._data?.notifyName || '', msg.fromMe, content, userId);

      if (chat) {
        await saveMessage(
          chat.id,
          remoteJid,
          msg.id._serialized || msg.id,
          msg.fromMe,
          content,
          mediaType,
          msg.fromMe ? 'SENT' : 'RECEIVED',
          msg.timestamp,
          userId || chat.user_id || null
        );

        if (!msg.fromMe && chat.lead_id) {
          await supabase.from('leads').update({ status_pipeline: 'REPLIED' }).eq('id', chat.lead_id);
        } else if (msg.fromMe && chat.lead_id) {
          await supabase.from('leads').update({ status_pipeline: 'CONTACTED' }).eq('id', chat.lead_id).eq('status_pipeline', 'QUEUED');
        }
      }
    }
    
    // ── Evento: Message Ack (Status de Leitura) ────────
    if (body.event === 'message.ack') {
      const msg = body.payload;
      const messageId = msg.id._serialized || msg.id;
      let status = '';
      
      if (msg.ack === 1) status = 'SENT';
      if (msg.ack === 2) status = 'DELIVERED';
      if (msg.ack === 3 || msg.ack === 4) status = 'READ';
      
      if (messageId && status) {
        await supabase.from('whatsapp_messages').update({ status }).eq('message_id', messageId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook WAHA Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
