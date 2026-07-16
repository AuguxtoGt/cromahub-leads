"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Save, 
  Sparkles, 
  Loader2, 
  RotateCcw, 
  Plus, 
  Trash2, 
  History, 
  ChevronDown, 
  ChevronUp, 
  ThumbsUp, 
  Clock, 
  Zap 
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_PROMPT = `Você é um assistente de prospecção via WhatsApp. Sua única função é gerar UMA frase curta e amigável perguntando se o número pertence à empresa em questão.

REGRA DE HORÁRIO:
Verifique o seu relógio interno (horário de Brasília).
- Se for de manhã, use saudações com "Bom dia".
- Se for de tarde, use saudações com "Boa tarde".
- Se não for nem um nem outro, ou se estiver na dúvida, use "Olá" ou "Oi".

VARIAÇÕES OBRIGATÓRIAS (Alterne entre esses estilos):
1. "[Saudação], é da empresa {{nome_empresa}}?"
2. "[Saudação], tudo bem? É da empresa {{nome_empresa}}?"
3. "[Saudação], tudo joia? É da empresa {{nome_empresa}}?"
4. "Oi, tudo bem? É da empresa {{nome_empresa}}?"
5. "Olá, é da empresa {{nome_empresa}}?"

INSTRUÇÕES FINAIS:
- Não escreva absolutamente MAIS NADA na resposta. Nenhuma explicação, nenhuma introdução, apenas a frase gerada.
- Sempre substitua {{nome_empresa}} pelo nome da empresa.`;

const DEFAULT_FOLLOW_UP_PROMPT = `Você é um assistente de prospecção. Sua única função é gerar UMA mensagem curta de follow-up (resgate) para ser enviada 24h depois caso o cliente não responda à primeira mensagem.

VARIAÇÕES OBRIGATÓRIAS (Alterne entre esses estilos):
1. "Oi, não tive retorno, é da empresa {{nome_empresa}}?"
2. "Olá, vi que não respondeu, é da empresa {{nome_empresa}}?"
3. "Oi tudo bem? Não tive retorno na mensagem anterior, é da empresa {{nome_empresa}}?"

INSTRUÇÕES FINAIS:
- Não escreva absolutamente MAIS NADA na resposta.
- Sempre substitua {{nome_empresa}} pelo nome da empresa.`;

interface Example { id: string; text: string; label: string; }
interface PromptVersion { version: number; prompt: string; saved_at: string; }

export default function InstrucoesPage() {
  const [settings, setSettings] = useState({
    system_prompt: DEFAULT_PROMPT,
    follow_up_prompt: DEFAULT_FOLLOW_UP_PROMPT,
    follow_up_enabled: true,
    offer_name: "",
    offer_price: "",
    offer_deadline: "",
    owner_name: "",
    owner_whatsapp: "",
    version: 1,
    dispatch_start_hour: 8,
    dispatch_end_hour: 18,
    dispatch_daily_limit: 50,
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
    const { data } = await supabase.from("settings").select("*").single();
    if (data) {
      setSettings({
        system_prompt: data.system_prompt || DEFAULT_PROMPT,
        follow_up_prompt: data.follow_up_prompt || DEFAULT_FOLLOW_UP_PROMPT,
        follow_up_enabled: data.follow_up_enabled !== false,
        offer_name: data.offer_name || "",
        offer_price: data.offer_price || "",
        offer_deadline: data.offer_deadline || "",
        owner_name: data.owner_name || "",
        owner_whatsapp: data.owner_whatsapp || "",
        version: data.version || 1,
        dispatch_start_hour: data.dispatch_start_hour ?? 8,
        dispatch_end_hour: data.dispatch_end_hour ?? 18,
        dispatch_daily_limit: data.dispatch_daily_limit ?? 50,
      });
      setExamples(data.message_examples || []);
      setHistory(data.prompt_history || []);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    const newHistoryEntry: PromptVersion = {
      version: settings.version,
      prompt: settings.system_prompt,
      saved_at: new Date().toISOString(),
    };
    const updatedHistory = [newHistoryEntry, ...history].slice(0, 10);

    const { data: existing } = await supabase.from("settings").select("id").single();
    const payload = {
      ...settings,
      version: settings.version + 1,
      message_examples: examples,
      prompt_history: updatedHistory,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      const { error: updateError } = await supabase.from("settings").update(payload).eq("id", existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("settings").insert({
        id: crypto.randomUUID(),
        ...payload
      });
      error = insertError;
    }

    if (!error) {
      setHistory(updatedHistory);
      setSettings(s => ({ ...s, version: s.version + 1 }));
      setSaved(true);
      toast.success("Instruções e regras salvas!");
      setTimeout(() => setSaved(false), 3000);
    } else {
      console.error("Save error:", error);
      toast.error("Erro ao salvar: " + error.message);
    }
    setIsSaving(false);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setPreviewMessage("");
    setPreviewFollowUp("");
    try {
      const examplesBlock = examples.length > 0
        ? `\n\nExemplos de mensagens que funcionaram bem:\n${examples.map((e, i) => `\n--- Exemplo ${i + 1}${e.label ? ` (${e.label})` : ""} ---\n${e.text}`).join("\n")}`
        : "";

      const res = await fetch("/api/ai-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: settings.system_prompt + examplesBlock,
          follow_up_prompt: settings.follow_up_prompt,
          follow_up_enabled: settings.follow_up_enabled,
          lead_name: testLeadName,
          offer_name: settings.offer_name,
          offer_price: settings.offer_price,
          offer_deadline: settings.offer_deadline,
          owner_name: settings.owner_name,
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
        fetchSettings();
        toast.success("Prompt otimizado com sucesso!");
      } else {
        toast.error("Erro ao otimizar prompt: " + data.error);
      }
    } catch (error) {
      toast.error("Erro de conexão.");
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Instruções IA</h1>
          <p className="text-muted-foreground text-sm mt-1">Treine o seu vendedor inteligente e defina regras de disparo</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "✓ Salvo!" : isSaving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </div>

      {/* Regras de Disparo */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" /> Regras de Disparo
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina os horários e o limite diário para envio automático de mensagens pelo n8n.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Início dos disparos
            </label>
            <div className="flex items-center border border-border rounded-md overflow-hidden focus-within:border-primary transition-all">
              <input
                type="number" min={0} max={23}
                value={settings.dispatch_start_hour}
                onChange={e => setSettings(s => ({ ...s, dispatch_start_hour: Number(e.target.value) }))}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              />
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-l border-border">h</span>
            </div>
            <p className="text-xs text-muted-foreground">Após esse horário os envios começam</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Fim dos disparos
            </label>
            <div className="flex items-center border border-border rounded-md overflow-hidden focus-within:border-primary transition-all">
              <input
                type="number" min={0} max={23}
                value={settings.dispatch_end_hour}
                onChange={e => setSettings(s => ({ ...s, dispatch_end_hour: Number(e.target.value) }))}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              />
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-l border-border">h</span>
            </div>
            <p className="text-xs text-muted-foreground">Após esse horário os envios param</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Limite Diário
            </label>
            <div className="flex items-center border border-border rounded-md overflow-hidden focus-within:border-primary transition-all">
              <input
                type="number" min={1} max={500}
                value={settings.dispatch_daily_limit}
                onChange={e => setSettings(s => ({ ...s, dispatch_daily_limit: Number(e.target.value) }))}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white"
              />
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-l border-border">msg/dia</span>
            </div>
            <p className="text-xs text-muted-foreground">Máximo de mensagens enviadas por dia</p>
          </div>
        </div>

        <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 flex items-start gap-3">
          <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Intervalo entre disparos: 3 a 6 minutos (aleatório)</p>
            <p className="text-xs text-amber-600 mt-0.5">
              O intervalo é dinâmico e aleatório entre 3 e 6 minutos para evitar marcação como spam e reduzir drasticamente o risco de bloqueios no WhatsApp.
            </p>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div>
            <h2 className="font-semibold text-foreground text-lg">🤖 Prompt do Agente IA</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              As instruções do seu vendedor da IA. 
              <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">v{settings.version}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button
                onClick={() => setShowHistory(h => !h)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                Histórico ({history.length})
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={() => setSettings(s => ({ ...s, system_prompt: DEFAULT_PROMPT }))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border hover:bg-muted transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Padrão
            </button>
          </div>
        </div>

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
            <li>Adicione frases que você mesmo usaria para abordar clientes frios</li>
            <li>Mencione objeções comuns e explique o tom de voz amigável que a IA deve ter</li>
          </ul>
        </div>

        <textarea
          value={settings.system_prompt}
          onChange={e => setSettings(s => ({ ...s, system_prompt: e.target.value }))}
          rows={15}
          className="w-full px-4 py-3 border border-border rounded-lg text-sm font-mono outline-none focus:border-primary transition-all resize-none leading-relaxed bg-white"
          placeholder="Escreva aqui as instruções do seu agente de IA..."
        />
        
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Prompt de Follow-up
            </h3>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-muted-foreground">{settings.follow_up_enabled ? 'Ativado' : 'Desativado'}</span>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings.follow_up_enabled ? 'bg-primary' : 'bg-slate-300'}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={settings.follow_up_enabled}
                  onChange={(e) => setSettings(s => ({ ...s, follow_up_enabled: e.target.checked }))}
                />
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.follow_up_enabled ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">
            Instruções exclusivas para a mensagem de resgate (enviada caso o lead não responda a primeira mensagem).
          </p>

          {settings.follow_up_enabled ? (
            <textarea
              value={settings.follow_up_prompt}
              onChange={e => setSettings(s => ({ ...s, follow_up_prompt: e.target.value }))}
              rows={6}
              className="w-full px-4 py-3 border border-border rounded-lg text-sm font-mono outline-none focus:border-primary transition-all resize-none leading-relaxed bg-white"
              placeholder="Escreva aqui as instruções do follow-up..."
            />
          ) : (
            <div className="bg-slate-50 border border-border border-dashed rounded-lg p-6 text-center text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">O Follow-up automático está desativado.</p>
              <p className="text-xs mt-1">Ative o botão acima para permitir que a IA gere mensagens de resgate.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mensagens que Funcionaram */}
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

        {addingExample && (
          <div className="bg-green-50/50 border border-green-200 rounded-lg p-4 flex flex-col gap-3">
            <input
              type="text"
              value={newExample.label}
              onChange={e => setNewExample(n => ({ ...n, label: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-green-500 bg-white"
              placeholder="Rótulo (ex: 'Pet Shop - Abordagem Fria')"
            />
            <textarea
              value={newExample.text}
              onChange={e => setNewExample(n => ({ ...n, text: e.target.value }))}
              rows={4}
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
            <p>Nenhum exemplo cadastrado. Quando uma mensagem der resultado, adicione-a aqui.</p>
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

      {/* Testar Agente */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">👁️ Testar Agente</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Simule a geração de mensagem com o prompt e exemplos atuais.</p>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome de empresa para teste</label>
            <input type="text" value={testLeadName} onChange={e => setTestLeadName(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary bg-white"
              placeholder="Pet Shop Exemplo BH" />
          </div>
          <button onClick={handleTest} disabled={isTesting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-60">
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isTesting ? "Gerando..." : "Gerar Prévia"}
          </button>
        </div>

        {previewMessage && (
          <div className="bg-white border border-border rounded-lg p-5 text-sm text-foreground flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Abordagem Principal</span>
              <p className="whitespace-pre-wrap leading-relaxed">{previewMessage}</p>
            </div>
            {settings.follow_up_enabled && previewFollowUp && (
              <div className="border-t border-border pt-4">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Mensagem de Follow-up</span>
                <p className="whitespace-pre-wrap leading-relaxed">{previewFollowUp}</p>
              </div>
            )}

            <div className="border-t border-border pt-4 flex flex-col gap-3">
              <span className="text-xs font-bold text-foreground">💡 Quer sugerir ajustes na escrita da IA?</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Ex: Deixe mais curta, não use emojis..."
                  className="flex-1 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
                />
                <button
                  onClick={handleImprovePrompt}
                  disabled={isImproving || !feedback.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                >
                  {isImproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Otimizar Prompt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
