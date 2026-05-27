import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { system_prompt, lead_name, offer_price, offer_deadline } = await req.json();

    const userPrompt = `DADOS DO LEAD:
- Nome da empresa: ${lead_name}

DADOS DA OFERTA (use essas informações caso o seu system prompt instrua, caso contrário ignore):
- Produto sendo ofertado: Landing Page profissional
- Preço: R$${offer_price}
- Prazo de entrega: ${offer_deadline}

Siga RIGOROSAMENTE as regras e restrições do seu System Prompt, especialmente sobre limite de tamanho, tom de voz e o que NÃO mencionar. Escreva APENAS a mensagem final, sem introdução.`;

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
