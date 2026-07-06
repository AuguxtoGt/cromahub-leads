"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Save, Sparkles, Loader2, RotateCcw, Plus, Trash2, History, ChevronDown, ChevronUp, ThumbsUp, Lock, Eye, EyeOff, ShieldCheck, LogOut } from "lucide-react";
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

export default function SettingsPage() {
  const router = useRouter();
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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
        follow_up_enabled: data.follow_up_enabled !== false, // default true
        offer_name: data.offer_name || "",
        offer_price: data.offer_price || "",
        offer_deadline: data.offer_deadline || "",
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
      toast.success("Configurações salvas com sucesso!");
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
        // Recarrega o histórico para pegar a versão que foi salva pela API
        fetchSettings();
        toast.success("Prompt melhorado e salvo com sucesso!");
      } else {
        toast.error("Erro ao melhorar prompt: " + data.error);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("ATENÇÃO: Você está prestes a excluir sua conta. Isso apagará permanentemente todos os seus leads, configurações e histórico de mensagens. Esta ação NÃO pode ser desfeita. Tem certeza absoluta que deseja continuar?")) {
      return;
    }
    
    setIsDeletingAccount(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Conta excluída com sucesso.");
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        toast.error("Erro ao excluir conta: " + (data.error || "Desconhecido"));
      }
    } catch (err) {
      toast.error("Erro de conexão ao excluir conta.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure e treine seu agente de IA</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-md font-medium text-sm hover:bg-red-100 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "✓ Salvo!" : isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
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
              rows={8}
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
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "✓ Salvo!" : isSaving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>

      {/* Segurança */}
      <SecuritySection />
      
      {/* Danger Zone */}
      <DangerZone isDeletingAccount={isDeletingAccount} handleDeleteAccount={handleDeleteAccount} />
    </div>
  );
}

function SecuritySection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const passwordStrength = () => {
    if (newPassword.length === 0) return 0;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
  const strength = passwordStrength();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (newPassword.length < 8) {
      setErrorMsg("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setIsChanging(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error("Erro ao atualizar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      // Logout from other devices
      await supabase.auth.signOut({ scope: 'others' });
      toast.info("Outras sessões foram desconectadas.");
    }

    setIsChanging(false);
  };

  return (
    <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
      <div className="border-b border-border pb-3 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="font-semibold text-foreground text-lg">🔒 Segurança</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Altere sua senha de acesso.</p>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        {/* Nova Senha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 border border-border rounded-md text-sm outline-none focus:border-primary transition-all"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= strength ? strengthColor[strength] : "#e5e7eb" }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strengthColor[strength] }}>
                  {strengthLabel[strength]}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 border border-border rounded-md text-sm outline-none focus:border-primary transition-all"
                placeholder="Repita a nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs ${newPassword === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                {newPassword === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={isChanging || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isChanging ? "Salvando..." : "Alterar Senha"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DangerZone({ isDeletingAccount, handleDeleteAccount }: { isDeletingAccount: boolean, handleDeleteAccount: () => void }) {
  return (
    <div className="bg-red-50/50 border border-red-200 rounded-xl p-6 shadow-sm flex flex-col gap-5 mt-8">
      <div className="border-b border-red-200 pb-3 flex items-center gap-2">
        <Trash2 className="w-5 h-5 text-red-600" />
        <div>
          <h2 className="font-semibold text-red-700 text-lg">Zona de Perigo</h2>
          <p className="text-sm text-red-600/80 mt-0.5">Ações destrutivas para sua conta.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 p-4 rounded-lg border border-red-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Excluir Conta</h3>
          <p className="text-xs text-gray-500 mt-1">
            Apaga permanentemente sua conta, leads, histórico de mensagens e configurações. Esta ação não pode ser desfeita.
          </p>
        </div>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {isDeletingAccount ? "Excluindo..." : "Excluir Conta"}
        </button>
      </div>
    </div>
  );
}
