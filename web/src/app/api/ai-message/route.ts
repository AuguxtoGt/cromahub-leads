import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });
    }

    // Buscar o lead no banco
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    }

    // Buscar o prompt customizado e exemplos das configurações
    const { data: settingsData } = await supabase
      .from('settings')
      .select('system_prompt, offer_price, offer_deadline, message_examples')
      .eq('id', 'default')
      .single();

    const basePrompt = settingsData?.system_prompt || `Você é um vendedor consultivo especialista em presença digital para pequenos negócios.`;
    const offerPrice = settingsData?.offer_price || '297';
    const offerDeadline = settingsData?.offer_deadline || '24 horas';

    // Adiciona exemplos reais ao prompt (few-shot learning)
    const examples: any[] = settingsData?.message_examples || [];
    const examplesBlock = examples.length > 0
      ? `\n\nExemplos de mensagens que funcionaram bem (aprenda o estilo e tom):\n${examples.map((e: any, i: number) => `\n--- Exemplo ${i + 1}${e.label ? ` (${e.label})` : ''} ---\n${e.text}`).join('\n')}`
      : '';

    const systemPrompt = basePrompt + examplesBlock;

    // Gerar mensagem com OpenAI usando o prompt customizado
    const userPrompt = `Gere uma mensagem de prospecção para esta empresa:
- Nome: ${lead.name}
- Endereço: ${lead.formatted_address || 'Belo Horizonte'}
- Produto: Landing Page profissional
- Preço: R$${offerPrice}
- Prazo: ${offerDeadline}

Use {{nome_empresa}} substituído por "${lead.name}". Escreva APENAS a mensagem final.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 350,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI Error:', err);
      return NextResponse.json({ error: 'Erro ao gerar mensagem com IA' }, { status: 500 });
    }

    const aiData = await response.json();
    const aiMessage = aiData.choices[0]?.message?.content?.trim();

    if (!aiMessage) {
      return NextResponse.json({ error: 'IA não retornou mensagem' }, { status: 500 });
    }

    // Salvar mensagem no banco e atualizar status
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({ ai_message: aiMessage, status_pipeline: 'READY' })
      .eq('id', lead_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead: updated, message: aiMessage });

  } catch (error: any) {
    console.error('AI Message Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
