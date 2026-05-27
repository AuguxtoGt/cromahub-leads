"use client";

import { useState, useEffect, useCallback } from "react";
import { SlideOver } from "@/components/ui/SlideOver";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, Send, CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState({ name: '', phone: '' });
  const [isSavingLead, setIsSavingLead] = useState(false);

  useEffect(() => {
    fetchLeads();

    const leadsSubscription = supabase
      .channel('public:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, []);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Gera a mensagem da IA para um lead
  const handleGenerateMessage = async (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    setLoadingLeadId(lead.id + '_ai');
    try {
      const res = await fetch('/api/ai-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const data = await res.json();
      if (data.success) {
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l));
      } else {
        alert('Erro ao gerar mensagem: ' + data.error);
      }
    } catch (err) {
      alert('Erro de conexão com a IA.');
    } finally {
      setLoadingLeadId(null);
    }
  };

  // Enfileira o lead para disparo
  const handleQueueLead = async (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    setLoadingLeadId(lead.id + '_queue');
    try {
      const res = await fetch('/api/queue-lead', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const data = await res.json();
      if (data.success) {
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l));
      }
    } catch (err) {
      alert('Erro ao enfileirar lead.');
    } finally {
      setLoadingLeadId(null);
    }
  };

  // Salvar lead manual
  const handleSaveManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadData.name || !newLeadData.phone) return;
    
    // Limpa o número para deixar apenas números
    const cleanPhone = newLeadData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert("Por favor, digite um número válido com DDD.");
      return;
    }

    try {
      setIsSavingLead(true);
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: newLeadData.name,
          phone: cleanPhone,
          status_pipeline: 'NEW',
          place_id: `manual_${Date.now()}`
        })
        .select()
        .single();

      if (error) throw error;
      
      setLeads(prev => [data, ...prev]);
      setIsAddModalOpen(false);
      setNewLeadData({ name: '', phone: '' });
    } catch (err: any) {
      alert('Erro ao salvar lead: ' + err.message);
    } finally {
      setIsSavingLead(false);
    }
  };

  const getPipelineStatus = (lead: any) => {
    switch (lead.status_pipeline) {
      case 'READY':   return { label: 'Msg Pronta', color: 'bg-purple-50 text-purple-600 border-purple-200' };
      case 'QUEUED':  return { label: 'Na Fila 🕐', color: 'bg-amber-50 text-amber-600 border-amber-200' };
      case 'SENDING': return { label: 'Enviando...', color: 'bg-blue-50 text-blue-600 border-blue-200' };
      case 'SENT':    return { label: 'Enviado ✓', color: 'bg-green-50 text-green-600 border-green-200' };
      case 'FAILED':  return { label: 'Falhou', color: 'bg-red-50 text-red-600 border-red-200' };
      default:        return { label: 'Novo', color: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
  };

  const stats = {
    total: leads.length,
    novo: leads.filter(l => !l.status_pipeline || l.status_pipeline === 'NEW').length,
    pronto: leads.filter(l => l.status_pipeline === 'READY').length,
    enviado: leads.filter(l => l.status_pipeline === 'SENT').length,
    fila: leads.filter(l => l.status_pipeline === 'QUEUED' || l.status_pipeline === 'SENDING').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Leads</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Lead Manual
          </button>
          <button 
            onClick={fetchLeads}
            className="px-4 py-2 border border-border bg-sidebar rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Atualizar
          </button>
          <button className="px-4 py-2 border border-border bg-sidebar rounded-md text-sm font-medium hover:bg-muted transition-colors">
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { title: "Total Leads", value: stats.total.toString(), icon: "🗂️" },
          { title: "Novos", value: stats.novo.toString(), icon: "✨" },
          { title: "Msg Pronta", value: stats.pronto.toString(), icon: "🤖" },
          { title: "Na Fila", value: stats.fila.toString(), icon: "⏳" },
          { title: "Enviados", value: stats.enviado.toString(), icon: "✅" },
        ].map((card, i) => (
          <div key={i} className="bg-sidebar border border-border rounded-xl p-5 flex flex-col gap-2 shadow-sm">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span>{card.icon}</span>
              {card.title}
            </span>
            <span className="text-3xl font-bold">{card.value}</span>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-sidebar border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <input 
            type="text" 
            placeholder="Buscar leads..." 
            className="w-64 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-border rounded-md text-sm font-medium hover:bg-muted">Ordenar</button>
            <button className="px-3 py-1.5 border border-border rounded-md text-sm font-medium hover:bg-muted">Filtrar</button>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-8 gap-4 p-4 border-b border-border text-xs font-semibold tracking-wider text-muted-foreground uppercase bg-muted/30">
          <div className="col-span-2">Lead</div>
          <div>Telefone</div>
          <div>Canal</div>
          <div>Status</div>
          <div>Data</div>
          <div className="col-span-2 text-center">Ações</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border relative min-h-[200px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : leads.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
               Nenhum lead encontrado. Vá para a aba de Extração.
             </div>
          ) : (
            leads.map((lead) => {
              const pipeline = getPipelineStatus(lead);
              const isGenerating = loadingLeadId === lead.id + '_ai';
              const isQueuing = loadingLeadId === lead.id + '_queue';

              return (
                <div 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className="grid grid-cols-8 gap-4 p-4 items-center text-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  {/* Nome */}
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-medium text-foreground truncate">{lead.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.website ? 'Tem link' : 'Sem site'}
                      </span>
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="text-muted-foreground truncate">{lead.phone || "–"}</div>

                  {/* Canal */}
                  <div className="text-muted-foreground">Google Maps</div>

                  {/* Status Pipeline */}
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${pipeline.color}`}>
                      {pipeline.label}
                    </span>
                    {lead.status_pipeline === 'FAILED' && lead.error_message && (
                      <span className="text-[10px] text-red-500 max-w-[120px] truncate" title={lead.error_message}>
                        {lead.error_message}
                      </span>
                    )}
                  </div>

                  {/* Data */}
                  <div className="text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Ações */}
                  <div className="col-span-2 flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                    {/* Botão Gerar IA */}
                    {(!lead.status_pipeline || lead.status_pipeline === 'NEW') && (
                      <button
                        onClick={(e) => handleGenerateMessage(e, lead)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {isGenerating ? 'Gerando...' : 'Gerar IA'}
                      </button>
                    )}

                    {/* Botões para QUEUED, SENT, SENDING ou FAILED */}
                    {(lead.status_pipeline === 'QUEUED' || lead.status_pipeline === 'SENT' || lead.status_pipeline === 'SENDING' || lead.status_pipeline === 'FAILED') && (
                       <button
                          onClick={(e) => handleGenerateMessage(e, lead)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors disabled:opacity-60"
                        >
                          {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Gerar Novamente
                        </button>
                    )}

                    {/* Botão Disparar — só aparece quando a msg está pronta */}
                    {lead.status_pipeline === 'READY' && (
                      <>
                        <button
                          onClick={(e) => handleQueueLead(e, lead)}
                          disabled={isQueuing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                          {isQueuing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          {isQueuing ? 'Enfileirando...' : 'Disparar'}
                        </button>
                        <button
                          onClick={(e) => handleGenerateMessage(e, lead)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors disabled:opacity-60"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Refazer
                        </button>
                      </>
                    )}

                    {/* Status final */}
                    {lead.status_pipeline === 'QUEUED' && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-600">
                        <Clock className="w-3.5 h-3.5" /> Aguardando disparo...
                      </span>
                    )}
                    {lead.status_pipeline === 'SENT' && (
                      <span className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mensagem enviada
                      </span>
                    )}
                    {lead.status_pipeline === 'FAILED' && (
                      <button
                        onClick={(e) => handleQueueLead(e, lead)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                      >
                        <AlertCircle className="w-3.5 h-3.5" /> Tentar Novamente
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <SlideOver 
        isOpen={!!selectedLead} 
        onClose={() => setSelectedLead(null)} 
        lead={selectedLead} 
        onGenerateIA={(l) => handleGenerateMessage({ stopPropagation: () => {} } as any, l)}
        onQueueLead={(l) => handleQueueLead({ stopPropagation: () => {} } as any, l)}
      />

      {/* Modal de Adicionar Lead Manual */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-border font-semibold flex justify-between items-center">
              <span>Cadastrar Lead de Teste</span>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <form onSubmit={handleSaveManualLead} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome do Contato</label>
                <input 
                  type="text" 
                  value={newLeadData.name}
                  onChange={e => setNewLeadData(prev => ({...prev, name: e.target.value}))}
                  placeholder="Ex: João da Silva" 
                  className="w-full px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp (com DDD)</label>
                <input 
                  type="text" 
                  value={newLeadData.phone}
                  onChange={e => setNewLeadData(prev => ({...prev, phone: e.target.value}))}
                  placeholder="Ex: 11999999999" 
                  className="w-full px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingLead}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-70 flex items-center gap-2"
                >
                  {isSavingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
