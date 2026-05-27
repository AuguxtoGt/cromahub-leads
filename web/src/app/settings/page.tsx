"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Save, Sparkles, Loader2, RotateCcw, Plus, Trash2, History, ChevronDown, ChevronUp, ThumbsUp } from "lucide-react";

const DEFAULT_PROMPT = `Você é um vendedor consultivo especialista em presença digital para pequenos negócios. Sua missão é abordar donos de empresas locais que ainda não têm site próprio e apresentar nossa oferta de forma natural, humana e persuasiva.

Sobre a oferta:
- Produto: Landing Page profissional
- Preço: R$297 (pagamento único)
- Prazo de entrega: até 24 horas
- Diferenciais: site no ar em 1 dia, design profissional, aparece no Google, link de WhatsApp integrado

Regras de ouro:
1. Comece de forma descontraída, como um amigo que quer ajudar
2. Mencione o nome da empresa para personalizar (use {{nome_empresa}})
3. Cite o nicho do negócio naturalmente para mostrar que conhece o mercado
4. Explique 1 ou 2 benefícios concretos (ex: "clientes que pesquisam no Google vão te encontrar")
5. Mencione o preço e prazo de forma confiante, não esconda
6. Termine com uma pergunta aberta ou CTA leve
7. Máximo 3 parágrafos curtos
8. Tom informal mas profissional
9. Sem emojis excessivos (máximo 2)
10. NÃO minta sobre entregas ou resultados garantidos`;

interface Example { id: string; text: string; label: string; }
interface PromptVersion { version: number; prompt: string; saved_at: string; }

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    system_prompt: DEFAULT_PROMPT,
    offer_name: "Landing Page Profissional",
    offer_price: "297",
    offer_deadline: "24 horas",
    owner_name: "",
    owner_whatsapp: "",
    version: 1,
  });
  const [examples, setExamples] = useState<Example[]>([]);
  const [history, setHistory] = useState<PromptVersion[]>([]);
  const [newExample, setNewExample] = useState({ text: "", label: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMessage, setPreviewMessage] = useState("");
  const [previewFollowUp, setPreviewFollowUp] = useState("");
  const [testLeadName, setTestLeadName] = useState("Pet Shop Exemplo BH");
  const [showHistory, setShowHistory] = useState(false);
  const [addingExample, setAddingExample] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isImproving, setIsImproving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", "default").single();
    if (data) {
      setSettings({
        system_prompt: data.system_prompt || DEFAULT_PROMPT,
        offer_name: data.offer_name || "Landing Page Profissional",
        offer_price: data.offer_price || "297",
        offer_deadline: data.offer_deadline || "24 horas",
        owner_name: data.owner_name || "",
        owner_whatsapp: data.owner_whatsapp || "",
        version: data.version || 1,
      });
      setExamples(data.message_examples || []);
      setHistory(data.prompt_history || []);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    // Adiciona a versão atual ao histórico antes de salvar a nova
    const newHistoryEntry: PromptVersion = {
      version: settings.version,
      prompt: settings.system_prompt,
      saved_at: new Date().toISOString(),
    };
    const updatedHistory = [newHistoryEntry, ...history].slice(0, 10); // Guarda últimas 10 versões

    const { error } = await supabase.from("settings").upsert({
      id: "default",
      ...settings,
      version: settings.version + 1,
      message_examples: examples,
      prompt_history: updatedHistory,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      setHistory(updatedHistory);
      setSettings(s => ({ ...s, version: s.version + 1 }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setIsSaving(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setPreviewMessage("");
    setPreviewFollowUp("");
    try {
      // Monta o prompt completo com exemplos
      const examplesBlock = examples.length > 0
        ? `\n\nExemplos de mensagens que funcionaram bem (use como referência de estilo e tom):\n${examples.map((e, i) => `\n--- Exemplo ${i + 1}${e.label ? ` (${e.label})` : ""} ---\n${e.text}`).join("\n")}`
        : "";

      const res = await fetch("/api/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: settings.system_prompt + examplesBlock,
          lead_name: testLeadName,
          offer_price: settings.offer_price,
          offer_deadline: settings.offer_deadline,
        }),
      });
      const data = await res.json();
      setPreviewMessage(data.message || "Erro ao gerar pré-visualização.");
      setPreviewFollowUp(data.follow_up || "");
    } catch {
      setPreviewMessage("Erro de conexão.");
      setPreviewFollowUp("");
    } finally {
      setIsTesting(false);
    }
  };

  const handleImprovePrompt = async () => {
    if (!feedback.trim() || !previewMessage) return;
    setIsImproving(true);
    try {
      const res = await fetch("/api/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_prompt: settings.system_prompt,
          generated_message: previewMessage,
          feedback: feedback,
        }),
      });
      const data = await res.json();
      if (data.success && data.improved_prompt) {
        setSettings(s => ({ ...s, system_prompt: data.improved_prompt, version: data.version }));
        setFeedback("");
        // Recarrega o histórico para pegar a versão que foi salva pela API
        fetchSettings();
        alert("Prompt melhorado e salvo com sucesso! Clique em 'Gerar Prévia' para ver o novo resultado.");
      } else {
        alert("Erro ao melhorar prompt: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão.");
    } finally {
      setIsImproving(false);
    }
  };

  const addExample = () => {
    if (!newExample.text.trim()) return;
    const ex: Example = {
      id: Date.now().toString(),
      text: newExample.text.trim(),
      label: newExample.label.trim() || `Exemplo ${examples.length + 1}`,
    };
    setExamples(prev => [...prev, ex]);
    setNewExample({ text: "", label: "" });
    setAddingExample(false);
  };

  const removeExample = (id: string) => {
    setExamples(prev => prev.filter(e => e.id !== id));
  };

  const restoreVersion = (v: PromptVersion) => {
    setSettings(s => ({ ...s, system_prompt: v.prompt }));
    setShowHistory(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure e treine seu agente de IA</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "✓ Salvo!" : isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Oferta */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">💼 Sua Oferta</h2>
          <p className="text-sm text-muted-foreground mt-0.5">O que você vende. A IA menciona isso em todas as mensagens.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Produto</label>
            <input type="text" value={settings.offer_name}
              onChange={e => setSettings(s => ({ ...s, offer_name: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              placeholder="Landing Page Profissional" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço (R$)</label>
            <div className="flex items-center border border-border rounded-md overflow-hidden focus-within:border-primary transition-all">
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-r border-border">R$</span>
              <input type="text" value={settings.offer_price}
                onChange={e => setSettings(s => ({ ...s, offer_price: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm outline-none" placeholder="297" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prazo de Entrega</label>
            <input type="text" value={settings.offer_deadline}
              onChange={e => setSettings(s => ({ ...s, offer_deadline: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              placeholder="24 horas" />
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-semibold text-foreground text-lg">🤖 Prompt do Agente IA</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              As instruções secretas do seu vendedor. 
              <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">v{settings.version}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
              >
                <History className="w-3 h-3" />
                Histórico ({history.length})
                {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
            <button
              onClick={() => setSettings(s => ({ ...s, system_prompt: DEFAULT_PROMPT }))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Padrão
            </button>
          </div>
        </div>

        {/* Histórico de versões */}
        {showHistory && (
          <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Versões anteriores</p>
            {history.map((v) => (
              <div key={v.version} className="flex items-center justify-between bg-white border border-border rounded-md px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {new Date(v.saved_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <button
                  onClick={() => restoreVersion(v)}
                  className="text-xs text-primary hover:underline"
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
          <p className="font-semibold mb-1">💡 Como editar para treinar melhor:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-600 text-xs">
            <li>Use <code className="bg-blue-100 px-1 rounded">{`{{nome_empresa}}`}</code> — substituído pelo nome real do lead</li>
            <li>Adicione frases que você mesmo usaria: "tipo assim: 'Oi, vi que vocês ainda não têm site...'"</li>
            <li>Mencione objeções comuns: "Se o cliente disser que é caro, não insista..."</li>
            <li>Cada versão salva fica no histórico — você nunca perde uma versão boa</li>
          </ul>
        </div>

        <textarea
          value={settings.system_prompt}
          onChange={e => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
          rows={18}
          className="w-full px-4 py-3 border border-border rounded-lg text-sm font-mono outline-none focus:border-primary transition-all resize-none leading-relaxed bg-white"
          placeholder="Escreva aqui as instruções do seu agente de IA..."
        />
      </div>

      {/* Exemplos de Mensagens que Funcionaram */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-semibold text-foreground text-lg">✅ Mensagens que Funcionaram</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cole aqui mensagens reais que geraram resposta. A IA vai aprender o estilo e o tom delas.
            </p>
          </div>
          <button
            onClick={() => setAddingExample(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>

        {/* Form para adicionar exemplo */}
        {addingExample && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col gap-3">
            <input
              type="text"
              value={newExample.label}
              onChange={e => setNewExample(n => ({ ...n, label: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-green-500 bg-white"
              placeholder="Rótulo (ex: 'Pet Shop - Gerou resposta em 10min')"
            />
            <textarea
              value={newExample.text}
              onChange={e => setNewExample(n => ({ ...n, text: e.target.value }))}
              rows={5}
              className="w-full px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-green-500 resize-none bg-white"
              placeholder="Cole aqui a mensagem completa que funcionou..."
            />
            <div className="flex gap-2">
              <button onClick={addExample}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" /> Salvar Exemplo
              </button>
              <button onClick={() => { setAddingExample(false); setNewExample({ text: "", label: "" }); }}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {examples.length === 0 && !addingExample ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum exemplo ainda. Quando uma mensagem gerar resposta,<br />cole ela aqui e a IA vai aprender com ela!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {examples.map((ex) => (
              <div key={ex.id} className="bg-white border border-border rounded-lg p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> {ex.label}
                  </span>
                  <button onClick={() => removeExample(ex.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ex.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">👁️ Testar Agente</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Veja como o agente vai escrever com o prompt e exemplos atuais.</p>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome de empresa para teste</label>
            <input type="text" value={testLeadName} onChange={e => setTestLeadName(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              placeholder="Pet Shop Exemplo BH" />
          </div>
          <button onClick={handleTest} disabled={isTesting}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60">
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isTesting ? "Gerando..." : "Gerar Prévia"}
          </button>
        </div>

        {previewMessage && (
          <div className="bg-white border border-border rounded-lg p-5 text-sm text-foreground shadow-inner flex flex-col gap-4">
            <div className="whitespace-pre-wrap leading-relaxed">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Mensagem gerada (1º Contato):
              </div>
              {previewMessage}
            </div>

            {previewFollowUp && (
              <div className="whitespace-pre-wrap leading-relaxed bg-blue-50/50 p-4 border border-blue-100 rounded-lg mt-2">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Mensagem de Follow-up (Dia Seguinte):
                </div>
                <span className="text-blue-900">{previewFollowUp}</span>
              </div>
            )}

            <div className="border-t border-border pt-4 mt-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                O que você quer mudar nesta mensagem? (Feedback para a IA)
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  rows={2}
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-purple-500 resize-none bg-slate-50"
                  placeholder="Ex: 'Ficou muito formal, seja mais amigável' ou 'Esqueceu de mencionar a mensalidade de 39,90'"
                />
                <button
                  onClick={handleImprovePrompt}
                  disabled={isImproving || !feedback.trim()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex flex-col items-center justify-center h-[54px] min-w-[100px]"
                >
                  {isImproving ? <Loader2 className="w-4 h-4 animate-spin mb-1" /> : <Sparkles className="w-4 h-4 mb-1 text-purple-300" />}
                  {isImproving ? "Melhorando..." : "Melhorar"}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setExamples(prev => [...prev, {
                  id: Date.now().toString(),
                  text: previewMessage,
                  label: `Prévia aprovada — ${testLeadName}`
                }]);
              }}
              className="mt-2 flex items-center gap-1.5 text-xs text-green-600 hover:underline w-fit"
            >
              <ThumbsUp className="w-3 h-3" /> Mensagem perfeita! Usar como exemplo de referência
            </button>
          </div>
        )}
      </div>

      {/* Dados do dono */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">👤 Seus Dados</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu Nome / Empresa</label>
            <input type="text" value={settings.owner_name}
              onChange={e => setSettings(s => ({ ...s, owner_name: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              placeholder="Gustavo - CromaHUB" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu WhatsApp</label>
            <input type="text" value={settings.owner_whatsapp}
              onChange={e => setSettings(s => ({ ...s, owner_whatsapp: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              placeholder="+55 31 9 9999-9999" />
          </div>
        </div>
      </div>
    </div>
  );
}
