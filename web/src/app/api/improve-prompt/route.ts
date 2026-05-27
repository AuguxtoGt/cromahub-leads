import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: Request) {
  try {
    const { current_prompt, generated_message, feedback } = await req.json();

    // O meta-prompt: uma IA que melhora o prompt de outra IA baseada em feedback humano
    const metaPrompt = `Você é um especialista em prompt engineering para vendas. 
    
Sua tarefa é reescrever o "system prompt" de um agente de vendas de forma agressiva para que ele obedeça EXATAMENTE ao feedback do usuário.

REGRAS IMPORTANTES:
1. Mantenha a essência do prompt original, mas ALTERE as instruções que entram em conflito com o feedback.
2. Incorpore o feedback do usuário como uma regra ESTRITA e INEGOCIÁVEL (em MAIÚSCULAS) no final do prompt.
3. Se o usuário pedir para a mensagem ser "mais curta", "menor", "direta", adicione uma regra de limite estrito (ex: "MÁXIMO DE 2 FRASES CURTAS" ou "NUNCA PASSE DE 3 LINHAS").
4. Se o usuário quiser remover preço ou prazo, adicione uma regra dizendo "NÃO MENCIONE PREÇO NEM PRAZO".
5. Retorne APENAS o prompt melhorado, sem explicações, sem aspas.`;

    const userMessage = `PROMPT ATUAL DO AGENTE:
---
${current_prompt}
---

MENSAGEM QUE O AGENTE GEROU:
---
${generated_message}
---

FEEDBACK DO USUÁRIO (o que ele quer melhorar):
---
${feedback}
---

Com base nesse feedback, reescreva o prompt para que o agente melhore nas próximas mensagens. Incorpore o feedback como regras explícitas no prompt.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // Usa o modelo mais capaz para reescrever prompts
        messages: [
          { role: 'system', content: metaPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 1500,
        temperature: 0.4, // Menos criativo, mais preciso para engenharia de prompt
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Erro na OpenAI' }, { status: 500 });
    }

    const data = await response.json();
    const improvedPrompt = data.choices[0]?.message?.content?.trim();

    if (!improvedPrompt) {
      return NextResponse.json({ error: 'IA não retornou prompt melhorado' }, { status: 500 });
    }

    // Buscar versão atual para histórico
    const { data: currentSettings } = await supabase
      .from('settings')
      .select('system_prompt, prompt_history, version')
      .eq('id', 'default')
      .single();

    const currentVersion = currentSettings?.version || 1;
    const history = currentSettings?.prompt_history || [];

    // Salva versão antiga no histórico
    const newHistory = [
      {
        version: currentVersion,
        prompt: currentSettings?.system_prompt || '',
        saved_at: new Date().toISOString(),
        feedback_used: feedback, // Guarda o feedback que gerou essa mudança
      },
      ...history,
    ].slice(0, 10);

    // Salva o prompt melhorado
    await supabase.from('settings').upsert({
      id: 'default',
      system_prompt: improvedPrompt,
      prompt_history: newHistory,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      improved_prompt: improvedPrompt,
      version: currentVersion + 1
    });

  } catch (error: any) {
    console.error('Improve Prompt Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
