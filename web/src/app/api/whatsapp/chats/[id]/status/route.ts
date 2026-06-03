import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await request.json();
    
    if (!status || !['UNANSWERED', 'ANSWERED', 'INTERESTED', 'CLOSED'].includes(status)) {
      return NextResponse.json({ error: 'Status inválido.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('whatsapp_chats')
      .update({ chat_status: status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, chat: data });
  } catch (error: any) {
    console.error('Chat status update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
