import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { system_prompt, lead_name, offer_price, offer_deadline, owner_name } = await req.json();

    const userPrompt = `DADOS DO LEAD:
- Nome da empresa: ${lead_name}
- Endereço/Cidade: Exemplo BH, Minas Gerais (dado simulado para teste)

DADOS DO VENDEDOR (QUEM ESTÁ ENVIANDO A MENSAGEM):
- Seu Nome: ${owner_name || 'Seu Nome'}

DADOS DA OFERTA (use essas informações caso o seu system prompt instrua, caso contrário ignore):
- Produto sendo ofertado: Landing Page profissional
- Preço: R$${offer_price}
- Prazo de entrega: ${offer_deadline}

Siga RIGOROSAMENTE as regras e restrições do seu System Prompt (especialmente sobre limite de tamanho e tom de voz).
IMPORTANTE: Você deve retornar APENAS um objeto JSON com duas chaves exatas:
{
  "primeira_mensagem": "O texto da mensagem de prospecção",
  "mensagem_follow_up": "A mensagem curta para o dia seguinte"
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
          { role: 'system', content: system_prompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Erro na OpenAI' }, { status: 500 });
    }

    const data = await response.json();
    const aiResponseContent = data.choices[0]?.message?.content?.trim();
    
    let parsedResponse = { primeira_mensagem: "Erro ao gerar", mensagem_follow_up: "" };
    try {
      parsedResponse = JSON.parse(aiResponseContent);
    } catch (e) {
      console.error('Failed to parse JSON preview:', aiResponseContent);
    }

    return NextResponse.json({ 
      message: parsedResponse.primeira_mensagem,
      follow_up: parsedResponse.mensagem_follow_up
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
