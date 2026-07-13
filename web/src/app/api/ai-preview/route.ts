import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/utils/rate-limit';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const schema = z.object({
  system_prompt: z.string(),
  follow_up_prompt: z.string().optional(),
  follow_up_enabled: z.boolean().optional(),
  lead_name: z.string(),
  offer_name: z.string().optional(),
  offer_price: z.string().optional(),
  offer_deadline: z.string().optional(),
  owner_name: z.string().optional()
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
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    const { system_prompt, follow_up_prompt, follow_up_enabled, lead_name, offer_name, offer_price, offer_deadline, owner_name } = parsed.data;

    // Saudação correta baseada no horário de Brasília para o preview ser realista
    const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const hour = nowBR.getHours();
    const saudacao = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    // Bloco de dados do vendedor — omite se vazio
    const vendedorLines = [
      owner_name ? `- Seu Nome / Empresa: ${owner_name}` : null,
    ].filter(Boolean).join('\n');

    // Bloco de oferta — só inclui campos preenchidos
    const ofertaLines = [
      offer_name ? `- Produto/Serviço: ${offer_name}` : null,
      offer_price ? `- Preço: R$${offer_price}` : null,
      offer_deadline ? `- Prazo de entrega: ${offer_deadline}` : null,
    ].filter(Boolean).join('\n');

    const userPrompt = `DADOS DO LEAD:
- Nome da empresa: ${lead_name}
- Endereço/Cidade: Exemplo BH, Minas Gerais (dado simulado para teste)
${vendedorLines ? `\nDADOS DO VENDEDOR (QUEM ESTÁ ENVIANDO A MENSAGEM):\n${vendedorLines}` : ''}
HORÁRIO ATUAL (BRASIL):
- Hora atual: ${hour}h
- Saudação OBRIGATÓRIA para usar no início da mensagem: "${saudacao}" (NÃO use outra saudação)
${ofertaLines ? `\nDADOS DA OFERTA (use se o seu system prompt instruir, caso contrário ignore):\n${ofertaLines}` : ''}
Siga RIGOROSAMENTE as regras e restrições do seu System Prompt (especialmente sobre limite de tamanho e tom de voz).
${follow_up_enabled !== false ? `IMPORTANTE: Você deve retornar APENAS um objeto JSON com duas chaves exatas:
{
  "primeira_mensagem": "O texto da mensagem de prospecção principal",
  "mensagem_follow_up": "A mensagem de follow-up seguindo a regra abaixo"
}

REGRA PARA A MENSAGEM DE FOLLOW-UP:
${follow_up_prompt || "Uma mensagem de 1 a 2 frases curtas, enviada 24h depois caso ele não responda, perguntando se ele conseguiu ver a mensagem anterior"}` : `IMPORTANTE: Você deve retornar APENAS um objeto JSON com uma chave exata:
{
  "primeira_mensagem": "O texto da mensagem de prospecção principal"
}`}`;


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
