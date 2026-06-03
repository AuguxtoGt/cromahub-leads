import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// POST /api/queue-lead/batch — Puxa leads da fila em lote (usado pelo n8n a cada hora)
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit') || '50';
    const limit = parseInt(limitParam);

    // 1. Busca leads na fila
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status_pipeline', 'QUEUED')
      .order('queued_at', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Erro ao buscar fila' }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ leads: [], message: 'Fila vazia' });
    }

    // 2. Trava os leads (muda para SENDING) para que não sejam pegos de novo
    const leadIds = leads.map(l => l.id);
    await supabase
      .from('leads')
      .update({ status_pipeline: 'SENDING' })
      .in('id', leadIds);

    return NextResponse.json({ leads, count: leads.length });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
