import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/supabase-api';

// PUT /api/queue-lead — Enfileira um lead para disparo
export async function PUT(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { lead_id } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('leads')
      .update({ 
        status_pipeline: 'QUEUED',
        queued_at: new Date().toISOString()
      })
      .eq('id', lead_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Erro ao enfileirar lead' }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: data });

  } catch (error: any) {
    console.error('Queue Lead PUT Error:', error);
    return NextResponse.json({ error: 'Erro interno ao enfileirar lead' }, { status: 500 });
  }
}

// GET /api/queue-lead — Pega o próximo lead da fila (para o n8n usar)
export async function GET(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('status_pipeline', 'QUEUED')
      .order('queued_at', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      // Fila vazia - retorna 200 com null (não é erro)
      return NextResponse.json({ lead: null, message: 'Fila vazia' });
    }

    // Marca como SENDING para não pegar duas vezes
    await supabase
      .from('leads')
      .update({ status_pipeline: 'SENDING' })
      .eq('id', data.id);

    return NextResponse.json({ lead: data });

  } catch (error: any) {
    console.error('Queue Lead GET Error:', error);
    return NextResponse.json({ error: 'Erro interno na busca da fila' }, { status: 500 });
  }
}

// PATCH /api/queue-lead — Marca como enviado ou falhou (chamado pelo n8n após o disparo)
export async function PATCH(req: Request) {
  try {
    const supabase = await getDbClient(req);
    const { lead_id, success, error_message } = await req.json();

    const updateData: any = {
      status_pipeline: success ? 'SENT' : 'FAILED',
      error_message: error_message || null
    };

    if (success) {
      updateData.sent_at = new Date().toISOString();
    }

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
    console.error('Queue Lead PATCH Error:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar lead na fila' }, { status: 500 });
  }
}
