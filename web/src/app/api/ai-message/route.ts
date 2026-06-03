import { NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { z } from 'zod';
import { checkRateLimit } from '@/utils/rate-limit';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const schema = z.object({
  lead_id: z.string().uuid()
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.success) {
      return NextResponse.json({ error: rateLimit.message }, { status: 429 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'lead_id inválido' }, { status: 400 });
    }

    const { lead_id } = parsed.data;

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
      .select('system_prompt, offer_price, offer_deadline, message_examples, owner_name')
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
    const userPrompt = `DADOS DO LEAD:
- Nome: ${lead.name}
- Endereço: ${lead.formatted_address || 'Não informado'}
- Cidade: ${lead.city || 'Não informada'}
- Estado: ${lead.state || 'Não informado'}

DADOS DO VENDEDOR (QUEM ESTÁ ENVIANDO A MENSAGEM):
- Seu Nome: ${settingsData?.owner_name || 'Gustavo'}

DADOS DA OFERTA (use essas informações caso o seu system prompt instrua, caso contrário ignore):
- Produto: Landing Page profissional
- Preço: R$${offerPrice}
- Prazo: ${offerDeadline}

Siga RIGOROSAMENTE as regras e restrições do seu System Prompt (especialmente sobre limite de tamanho e tom de voz).
IMPORTANTE: Você deve retornar APENAS um objeto JSON com duas chaves exatas:
{
  "primeira_mensagem": "O texto da mensagem de prospecção",
  "mensagem_follow_up": "Uma mensagem de 1 a 2 frases curtas, enviada 24h depois caso ele não responda, perguntando se ele conseguiu ver a mensagem e sugerindo mostrar um exemplo"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI Error:', err);
      return NextResponse.json({ error: 'Erro ao gerar mensagem com IA' }, { status: 500 });
    }

    const aiData = await response.json();
    const aiResponseContent = aiData.choices[0]?.message?.content?.trim();

    if (!aiResponseContent) {
      return NextResponse.json({ error: 'IA não retornou mensagem' }, { status: 500 });
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponseContent);
    } catch (e) {
      console.error('Failed to parse JSON:', aiResponseContent);
      return NextResponse.json({ error: 'IA não retornou um JSON válido' }, { status: 500 });
    }

    const { primeira_mensagem, mensagem_follow_up } = parsedResponse;

    if (!primeira_mensagem) {
      return NextResponse.json({ error: 'JSON não continha primeira_mensagem' }, { status: 500 });
    }

    // Substitui placeholders com os dados reais do lead
    const finalMessage = primeira_mensagem.replace(/\{\{nome_empresa\}\}/gi, lead.name);
    const finalFollowUp = mensagem_follow_up
      ? mensagem_follow_up.replace(/\{\{nome_empresa\}\}/gi, lead.name)
      : null;

    // Salvar mensagem no banco e atualizar status
    const { data: updated, error: updateError } = await supabase
      .from('leads')
      .update({ 
        ai_message: finalMessage, 
        ai_follow_up: finalFollowUp,
        status_pipeline: 'READY' 
      })
      .eq('id', lead_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar mensagem' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      lead: updated, 
      message: finalMessage,
      follow_up: finalFollowUp
    });

  } catch (error: any) {
    console.error('AI Message Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
