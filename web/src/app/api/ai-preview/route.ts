import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { system_prompt, lead_name, offer_price, offer_deadline } = await req.json();

    const userPrompt = `
Gere uma mensagem de prospecção para esta empresa:
- Nome da empresa: ${lead_name}
- Produto sendo ofertado: Landing Page profissional
- Preço: R$${offer_price}
- Prazo de entrega: ${offer_deadline}

Use o nome da empresa na mensagem de forma personalizada.
Escreva APENAS a mensagem final, sem aspas, sem introdução.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system_prompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 350,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Erro na OpenAI' }, { status: 500 });
    }

    const data = await response.json();
    const message = data.choices[0]?.message?.content?.trim();

    return NextResponse.json({ message });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
