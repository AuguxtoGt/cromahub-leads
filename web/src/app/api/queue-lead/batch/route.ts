import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

// POST /api/queue-lead/batch — Puxa leads da fila em lote (usado pelo n8n a cada hora)
// Versão 2.0: usa função atômica no banco para evitar duplicatas em execuções paralelas
export async function POST(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit') || '50';
    const limit = parseInt(limitParam);

    // Atômica: SELECT + UPDATE em uma única operação no banco.
    // Evita race condition onde dois workers pegariam os mesmos leads.
    const { data: leads, error } = await supabase.rpc('claim_queued_leads', {
      batch_limit: limit,
    });

    if (error) {
      console.error('Batch queue error:', error);
      return NextResponse.json({ error: 'Erro ao buscar fila' }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ leads: [], groups: [], count: 0, message: 'Fila vazia' });
    }

    // Agrupa os leads por user_id para que o n8n processe cada conta em paralelo.
    const groupsMap: Record<string, any[]> = {};
    for (const lead of leads) {
      const uid = lead.user_id as string;
      if (!groupsMap[uid]) groupsMap[uid] = [];
      groupsMap[uid].push(lead);
    }

    const groups = Object.entries(groupsMap).map(([user_id, userLeads]) => ({
      user_id,
      leads: userLeads,
      count: userLeads.length,
    }));

    return NextResponse.json({
      leads,   // lista plana (compatibilidade com fluxo antigo)
      groups,  // agrupado por user_id (para o novo fluxo paralelo)
      count: leads.length,
      group_count: groups.length,
    });

  } catch (error: any) {
    console.error('Queue Lead Batch Error:', error);
    return NextResponse.json({ error: 'Erro interno no processamento do lote' }, { status: 500 });
  }
}
