import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// GET /api/follow-up — Retorna leads enviados há mais de 24h que não responderam
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit') || '50';
    const limit = parseInt(limitParam);

    // Data de 24 horas atrás
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status_pipeline', 'SENT')
      // sent_at menor que 24h atrás significa que já passou de 24h
      .lt('sent_at', yesterday.toISOString()) 
      .order('sent_at', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar leads para follow-up' }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [], count: (leads || []).length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/follow-up — Marca lead como FOLLOW_UP_SENT
export async function PATCH(req: Request) {
  try {
    const { lead_id, success, error_message } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });
    }

    const updateData: any = {
      status_pipeline: success ? 'FOLLOW_UP_SENT' : 'FAILED', // Se falhar, vai para FAILED também
      error_message: error_message || null
    };

    const { data, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', lead_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: data });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
