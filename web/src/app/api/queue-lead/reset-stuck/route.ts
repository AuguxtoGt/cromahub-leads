import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

// POST /api/queue-lead/reset-stuck
// Reseta leads presos em SENDING por mais de 30 min de volta para QUEUED.
// Chamado automaticamente pelo n8n no início de cada execução do Fluxo 1.
export async function POST(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update({ status_pipeline: 'QUEUED' })
      .eq('status_pipeline', 'SENDING')
      .lt('queued_at', thirtyMinutesAgo)
      .select('id, name');

    if (error) {
      console.error('Reset Stuck Error:', error);
      return NextResponse.json({ error: 'Erro ao resetar leads na base de dados' }, { status: 500 });
    }

    return NextResponse.json({
      reset: data?.length ?? 0,
      leads: data?.map(l => l.name) ?? [],
      message: `${data?.length ?? 0} leads resetados de SENDING para QUEUED`,
    });
  } catch (err: any) {
    console.error('Reset Stuck Exception:', err);
    return NextResponse.json({ error: 'Erro interno ao resetar leads' }, { status: 500 });
  }
}
