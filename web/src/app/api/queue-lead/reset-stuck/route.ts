import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';

// POST /api/queue-lead/reset-stuck
// Reseta leads presos em SENDING por mais de 30 min de volta para QUEUED.
// Chamado automaticamente pelo n8n no início de cada execução do Fluxo 1.
export async function POST() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update({ status_pipeline: 'QUEUED' })
      .eq('status_pipeline', 'SENDING')
      .lt('queued_at', thirtyMinutesAgo)
      .select('id, name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      reset: data?.length ?? 0,
      leads: data?.map(l => l.name) ?? [],
      message: `${data?.length ?? 0} leads resetados de SENDING para QUEUED`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
