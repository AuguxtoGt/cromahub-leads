"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { SlideOver } from "@/components/ui/SlideOver";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, Send, CheckCircle2, Clock, AlertCircle, ChevronDown, X, Layers, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/types/database";

type SortField = "created_at" | "name" | "rating";
type SortDir = "desc" | "asc";
type FilterStatus = "ALL" | "NEW" | "READY" | "QUEUED" | "SENT" | "FAILED";

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Lead Manual State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLeadData, setNewLeadData] = useState({ name: '', phone: '' });
  const [isSavingLead, setIsSavingLead] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterHasWebsite, setFilterHasWebsite] = useState<"ALL" | "YES" | "NO">("ALL");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Batch state
  const [showBatchMenu, setShowBatchMenu] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, type: '' });

  const [nextDispatch, setNextDispatch] = useState<string>('');

  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateNextDispatch = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, ... 6 = Saturday

      if (day === 0 || day === 6 || h >= 18) {
        setNextDispatch(day === 5 && h >= 18 ? "Segunda 08:00" : day === 6 ? "Segunda 08:00" : "Amanhã 08:00");
      } else if (h < 8) {
        setNextDispatch("Hoje 08:00");
      } else {
        if (m < 20) setNextDispatch(`${h.toString().padStart(2, '0')}:20`);
        else if (m < 40) setNextDispatch(`${h.toString().padStart(2, '0')}:40`);
        else if (h === 17) setNextDispatch("Amanhã 08:00");
        else setNextDispatch(`${(h + 1).toString().padStart(2, '0')}:00`);
      }
    };
    updateNextDispatch();
    const interval = setInterval(updateNextDispatch, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchClients();

    const leadsSubscription = supabase
      .channel('public:leads')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
        const incoming = payload.new as any;
        // Ignora se o lead já está na lista (evita duplicação com o setLeads manual)
        setLeads(prev => prev.some(l => l.id === incoming.id) ? prev : [incoming, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, (payload) => {
        const updated = payload.new as any;
        // O ordenamento por status/data já é feito no processedLeads.sort, então apenas atualizamos o lead no estado
        setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, (payload) => {
        setLeads(prev => prev.filter(l => l.id !== (payload.old as any).id));
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          toast.error('Conexão em tempo real perdida. Atualize a página.', { duration: 10000 });
        }
      });

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterMenu(false);
      if (batchRef.current && !batchRef.current.contains(e.target as Node)) setShowBatchMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

  const handleExportSent = () => {
    const sentLeads = leads.filter(l => l.status_pipeline === 'SENT');
    if (sentLeads.length === 0) {
      toast.error("Nenhum lead com mensagem enviada para exportar.");
      return;
    }

    const headers = ["Nome", "Telefone", "Site", "Cidade", "Estado", "Mensagem IA", "Mensagem Follow-up"];
    const rows = sentLeads.map(l => [
      l.name || "",
      l.phone || "",
      l.website || "",
      l.city || "",
      l.state || "",
      l.ai_message || "",
      l.ai_follow_up || ""
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_enviados_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${sentLeads.length} leads exportados com sucesso!`);
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  const getClientStatus = (client: any): "PENDING" | "PAID" | "OVERDUE" => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    if (client.last_payment_date) {
      const payDate = new Date(client.last_payment_date);
      if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) {
        return "PAID";
      }
    }

    if (currentDay > client.due_day) {
      return "OVERDUE";
    }

    return "PENDING";
  };

  const financialMetrics = useMemo(() => {
    let totalMRR = 0;
    let totalPaid = 0;
    let totalPending = 0;

    clients.forEach(client => {
      const status = getClientStatus(client);
      const val = parseFloat(client.price) || 0;
      totalMRR += val;
      if (status === "PAID") {
        totalPaid += val;
      } else {
        totalPending += val;
      }
    });

    return {
      totalMRR,
      totalPaid,
      totalPending,
      clientCount: clients.length,
    };
  }, [clients]);

  const handleConvertToClient = async (lead: any) => {
    if (!lead.name) return;

    const priceInput = window.prompt(`Deseja converter o lead "${lead.name}" em cliente?\nDigite o valor da mensalidade (Ex: 399.90):`, "399.90");
    if (priceInput === null) return; // cancelou

    const monthlyPrice = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(monthlyPrice) || monthlyPrice < 0) {
      toast.error("Valor inválido de mensalidade.");
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('name', lead.name)
        .maybeSingle();

      if (existing) {
        toast.warning("Um cliente com este nome já existe!");
        return;
      }

      const domain = lead.website ? lead.website.replace(/https?:\/\//i, '').replace(/\/$/, '') : null;

      const { error } = await supabase
        .from('clients')
        .insert({
          name: lead.name,
          domain: domain,
          phone: lead.phone || null,
          price: monthlyPrice,
          setup_price: 297.00,
          due_day: 10,
        });

      if (error) throw error;

      toast.success(`Lead "${lead.name}" convertido em cliente com sucesso! 🎉`);
      fetchClients();
    } catch (err: any) {
      console.error("Erro ao converter lead:", err);
      toast.error(`Erro ao converter lead: ${err.message}`);
    }
  };

  const handleGenerateMessage = async (e: React.MouseEvent | null | undefined, lead: any) => {
    if (e) e.stopPropagation();
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
        toast.success("Mensagem IA gerada!");
      } else {
        toast.error('Erro ao gerar mensagem: ' + data.error);
      }
    } catch (err) {
      toast.error('Erro de conexão com a IA.');
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleQueueLead = async (e: React.MouseEvent | null | undefined, lead: any) => {
    if (e) e.stopPropagation();
    setLoadingLeadId(lead.id + '_queue');
    try {
      const res = await fetch('/api/queue-lead', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const data = await res.json();
      if (data.success) {
        // Atualiza o lead no estado — o ordenamento automático do frontend se encarrega de posicionar corretamente
        setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l));
        // Atualiza o painel lateral se estiver aberto neste lead
        if (selectedLead?.id === lead.id) setSelectedLead(data.lead);
        toast.success('Lead adicionado à fila de disparo! ⏳');
      } else {
        toast.error('Erro ao enfileirar lead: ' + (data.error || 'Desconhecido'));
      }
    } catch (err) {
      toast.error('Erro ao enfileirar lead.');
    } finally {
      setLoadingLeadId(null);
    }
  };


  const handleManualSend = async (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    const cleanPhone = (lead.phone || '').replace(/\D/g, '');
    const message = encodeURIComponent(lead.ai_message || lead.copy_gerada || '');
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');

    // Atualiza o status imediatamente — sem perguntar. 
    // O usuário clicou no botão, então a intenção de enviar é clara.
    try {
      const { data, error } = await supabase
        .from('leads')
        .update({ status_pipeline: 'SENT', sent_at: new Date().toISOString() })
        .eq('id', lead.id)
        .select()
        .single();

      if (!error && data) {
        // Atualiza o lead no estado — o ordenamento automático do frontend se encarrega de posicionar corretamente
        setLeads(prev => prev.map(l => l.id === lead.id ? data : l));
        if (selectedLead?.id === lead.id) setSelectedLead(data);
        toast.success('Mensagem aberta no WhatsApp. Lead marcado como Enviado ✓');
      } else {
        toast.error('Erro ao atualizar status do lead.');
      }
    } catch (err) {
      console.error('Erro ao atualizar status manual', err);
      toast.error('Erro ao atualizar status.');
    }
  };


  const handleDeleteLead = async (e: React.MouseEvent, lead: any) => {
    e.stopPropagation();
    if (!window.confirm(`Apagar "${lead.name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id);

      if (!error) {
        setLeads(prev => prev.filter(l => l.id !== lead.id));
        toast.success("Lead apagado permanentemente.");
      } else {
        toast.error('Erro ao apagar lead.');
      }
    } catch (err) {
      console.error('Erro ao apagar lead:', err);
    }
  };

  const handleBatchDelete = async (targetStatus?: string) => {
    setShowBatchMenu(false);
    const targetLeads = targetStatus === 'ALL'
      ? leads
      : targetStatus
        ? leads.filter(l => l.status_pipeline === targetStatus || (!l.status_pipeline && targetStatus === 'NEW'))
        : leads.filter(l => l.status_pipeline === 'SENT');

    if (targetLeads.length === 0) {
      toast.warning('Nenhum lead encontrado para apagar.');
      return;
    }
    if (!window.confirm(`Apagar ${targetLeads.length} leads permanentemente? Esta ação não pode ser desfeita.`)) return;

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: targetLeads.length, type: 'DELETE' });

    const ids = targetLeads.map(l => l.id);
    const { error } = await supabase.from('leads').delete().in('id', ids);

    if (!error) {
      setLeads(prev => prev.filter(l => !ids.includes(l.id)));
      toast.success(`${targetLeads.length} leads apagados.`);
    } else {
      toast.error('Erro ao apagar leads em massa.');
    }

    setTimeout(() => setIsBatchProcessing(false), 500);
  };

  const handleSaveManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadData.name || !newLeadData.phone) return;
    
    const cleanPhone = newLeadData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.warning("Por favor, digite um número de telefone válido com DDD.");
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

      // NÃO chama setLeads aqui — o Realtime INSERT já vai adicionar o lead.
      // Chamar os dois causaria duplicação.
      setIsAddModalOpen(false);
      setNewLeadData({ name: '', phone: '' });
      toast.success('Lead adicionado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar lead: ' + err.message);
    } finally {
      setIsSavingLead(false);
    }
  };

  const handleBatchGenerateIA = async (count: number | 'ALL', targetStatus: 'NEW' | 'READY' = 'NEW') => {
    setShowBatchMenu(false);
    
    let filteredLeads = leads;
    if (targetStatus === 'NEW') {
      filteredLeads = leads.filter(l => !l.status_pipeline || l.status_pipeline === 'NEW');
    } else if (targetStatus === 'READY') {
      filteredLeads = leads.filter(l => l.status_pipeline === 'READY' || l.status_pipeline === 'SENT');
    }

    const targetLeads = count === 'ALL' ? filteredLeads : filteredLeads.slice(0, count as number);
    
    if (targetLeads.length === 0) {
      toast.warning(`Nenhum lead com status ${targetStatus} disponível para gerar mensagem.`);
      return;
    }
    
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: targetLeads.length, type: 'AI' });
    
    let processedCount = 0;
    const chunkSize = 5; // Process 5 leads in parallel
    for (let i = 0; i < targetLeads.length; i += chunkSize) {
      const chunk = targetLeads.slice(i, i + chunkSize);
      
      await Promise.allSettled(chunk.map(async (lead) => {
        try {
          const res = await fetch('/api/ai-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_id: lead.id }),
          });
          const data = await res.json();
          if (data.success) {
            setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l));
          }
        } catch (err) {
          console.error("Erro no batch IA", err);
        }
        processedCount++;
        setBatchProgress(prev => ({ ...prev, current: processedCount }));
      }));
    }
    
    toast.success(`${processedCount} mensagens geradas!`);
    
    setTimeout(() => setIsBatchProcessing(false), 1000);
  };

  const handleBatchQueue = async (count: number | 'ALL') => {
    setShowBatchMenu(false);
    const readyLeads = leads.filter(l => l.status_pipeline === 'READY');
    const targetLeads = count === 'ALL' ? readyLeads : readyLeads.slice(0, count);

    if (targetLeads.length === 0) {
      toast.warning('Nenhum lead com mensagem pronta disponível.');
      return;
    }
    
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: targetLeads.length, type: 'QUEUE' });
    
    let processedCount = 0;
    for (const lead of targetLeads) {
      try {
        const res = await fetch('/api/queue-lead', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id }),
        });
        const data = await res.json();
        if (data.success) {
          // Atualiza o lead no estado — o ordenamento automático do frontend se encarrega de posicionar corretamente
          setLeads(prev => prev.map(l => l.id === lead.id ? data.lead : l));
        }
      } catch (err) {
        console.error('Erro no batch Queue', err);
      }
      processedCount++;
      setBatchProgress(prev => ({ ...prev, current: processedCount }));
    }

    toast.success(`${processedCount} leads adicionados à fila!`);
    setTimeout(() => setIsBatchProcessing(false), 1000);
  };


  const handleClearQueue = async () => {
    setShowBatchMenu(false);
    if (!window.confirm("Tem certeza que deseja remover todos os leads da fila de disparo? Eles voltarão para 'Msg Pronta'.")) return;
    
    setIsBatchProcessing(true);
    setBatchProgress({ current: 1, total: 1, type: 'CLEAR_QUEUE' });
    
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status_pipeline: 'READY' })
        .eq('status_pipeline', 'QUEUED');
        
      if (!error) {
        setLeads(prev => prev.map(l => l.status_pipeline === 'QUEUED' ? { ...l, status_pipeline: 'READY' } : l));
        toast.success("Fila esvaziada com sucesso.");
      } else {
        toast.error("Erro ao limpar fila.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsBatchProcessing(false), 500);
    }
  };

  const getPipelineStatus = (lead: any) => {
    switch (lead.status_pipeline) {
      case 'READY':   return { label: 'Msg Pronta', color: 'bg-purple-50 text-purple-600 border-purple-200' };
      case 'QUEUED':  return { label: `Na Fila (${nextDispatch})`, color: 'bg-amber-50 text-amber-600 border-amber-200' };
      case 'SENDING': return { label: 'Enviando...', color: 'bg-blue-50 text-blue-600 border-blue-200' };
      case 'SENT':    return { label: 'Enviado ✓', color: 'bg-green-50 text-green-600 border-green-200' };
      case 'FAILED':  return { label: 'Falhou', color: 'bg-red-50 text-red-600 border-red-200' };
      default:        return { label: 'Novo', color: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
  };

  const processedLeads = leads
    .filter(l => {
      if (search) {
        const q = search.toLowerCase();
        const match = (l.name || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.city || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterStatus !== "ALL") {
        const status = l.status_pipeline || "NEW";
        if (filterStatus === "NEW" && status !== "NEW" && status !== null && status !== undefined) return false;
        if (filterStatus !== "NEW" && status !== filterStatus) return false;
      }
      if (filterHasWebsite === "YES" && !l.website) return false;
      if (filterHasWebsite === "NO" && l.website) return false;
      return true;
    })
    .sort((a, b) => {
      // Leads enviados ou falhados vão para o final da lista (inativos)
      const isInactive = (status?: string) => status === 'SENT' || status === 'FAILED';
      const aInactive = isInactive(a.status_pipeline);
      const bInactive = isInactive(b.status_pipeline);

      if (aInactive && !bInactive) return 1;
      if (!aInactive && bInactive) return -1;

      let valA: any, valB: any;
      if (sortField === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortField === "name") {
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
      } else if (sortField === "rating") {
        valA = a.rating || 0;
        valB = b.rating || 0;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const stats = {
    total: leads.length,
    novo: leads.filter(l => !l.status_pipeline || l.status_pipeline === 'NEW').length,
    pronto: leads.filter(l => l.status_pipeline === 'READY').length,
    enviado: leads.filter(l => l.status_pipeline === 'SENT').length,
    fila: leads.filter(l => l.status_pipeline === 'QUEUED' || l.status_pipeline === 'SENDING').length,
    falhou: leads.filter(l => l.status_pipeline === 'FAILED').length,
  };

  const activeFilters = (filterStatus !== "ALL" ? 1 : 0) + (filterHasWebsite !== "ALL" ? 1 : 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Leads</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Lead Manual
          </button>
          
          <div ref={batchRef} className="relative">
            <button 
              onClick={() => { setShowBatchMenu(v => !v); setShowSortMenu(false); setShowFilterMenu(false); }}
              className="px-4 py-2 border border-blue-600 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Layers className="w-4 h-4" />
              Ações em Massa
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
            </button>
            {showBatchMenu && (
              <div className="absolute right-0 top-full mt-1.5 bg-white border border-border rounded-xl shadow-lg z-30 w-56 py-2 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/50 border-y border-border/50 mb-1">Gerar Mensagens (Novos)</p>
                <button onClick={() => handleBatchGenerateIA(10, 'NEW')} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center">
                  <span>10 leads</span>
                  <span className="text-xs text-muted-foreground">{stats.novo >= 10 ? 10 : stats.novo} Disp.</span>
                </button>
                <button onClick={() => handleBatchGenerateIA('ALL', 'NEW')} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center">
                  <span>Todos novos</span>
                  <span className="text-xs text-muted-foreground">{stats.novo} Disp.</span>
                </button>

                <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/50 border-y border-border/50 my-1 mt-2">Refazer Mensagens (Prontos/Enviados)</p>
                <button onClick={() => handleBatchGenerateIA('ALL', 'READY')} className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 transition-colors flex justify-between items-center font-medium">
                  <span>Refazer todos</span>
                  <span className="text-xs text-purple-400">{stats.pronto + stats.enviado} Disp.</span>
                </button>

                <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/50 border-y border-border/50 my-1 mt-2">Enfileirar Disparos</p>
                <button onClick={() => handleBatchQueue(10)} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center">
                  <span>10 leads</span>
                  <span className="text-xs text-muted-foreground">{stats.pronto >= 10 ? 10 : stats.pronto} Disp.</span>
                </button>
                <button onClick={() => handleBatchQueue('ALL')} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex justify-between items-center">
                  <span>Todos prontos</span>
                  <span className="text-xs text-muted-foreground">{stats.pronto} Disp.</span>
                </button>

                <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/50 border-y border-border/50 my-1 mt-2">Gerenciamento de Fila</p>
                <button onClick={handleClearQueue} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex justify-between items-center font-medium">
                  <span>Esvaziar Fila</span>
                  <span className="text-xs text-red-400">{stats.fila} na fila</span>
                </button>

                <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase bg-muted/50 border-y border-border/50 my-1 mt-2">Apagar Leads</p>
                <button onClick={() => handleBatchDelete('SENT')} className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors flex justify-between items-center font-medium">
                  <span>Apagar enviados</span>
                  <span className="text-xs text-red-400">{stats.enviado} leads</span>
                </button>
                <button onClick={() => handleBatchDelete('ALL')} className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors flex justify-between items-center font-medium">
                  <span>Apagar todos os leads</span>
                  <span className="text-xs text-red-400">{stats.total} leads</span>
                </button>
              </div>
            )}
          </div>

          <button 
            onClick={handleExportSent}
            className="px-4 py-2 border border-green-600 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exportar Enviados
          </button>

          <button 
            onClick={fetchLeads}
            className="px-4 py-2 border border-border bg-sidebar rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Seção 1: Funil de Prospecção */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Funil de Prospecção (Leads)
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {[
            { title: "Total Leads", value: stats.total.toString(), icon: "🗂️" },
            { title: "Novos", value: stats.novo.toString(), icon: "✨" },
            { title: "Msg Pronta", value: stats.pronto.toString(), icon: "🤖" },
            { title: "Na Fila", value: stats.fila.toString(), icon: "⏳", sublabel: `Próximo: ${nextDispatch}` },
            { title: "Enviados", value: stats.enviado.toString(), icon: "✅" },
            { title: "Falhados", value: stats.falhou.toString(), icon: "❌" },
          ].map((card, i) => (
            <div key={i} className="bg-sidebar border border-border rounded-xl p-5 flex flex-col gap-1 shadow-sm">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span>{card.icon}</span>
                {card.title}
              </span>
              <div className="flex flex-col">
                <span className="text-3xl font-bold">{card.value}</span>
                {card.sublabel && (
                  <span className="text-xs text-muted-foreground font-medium mt-1">{card.sublabel}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-sidebar border border-border rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-white">
          <input 
            type="text" 
            placeholder="Buscar leads..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <div ref={sortRef} className="relative">
              <button 
                onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false); setShowBatchMenu(false); }}
                className="px-3 py-1.5 border border-border rounded-md text-sm font-medium hover:bg-muted flex items-center gap-1.5"
              >
                Ordenar
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-border rounded-xl shadow-lg z-30 w-52 py-1 overflow-hidden">
                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Ordenar por</p>
                  {[
                    { field: "created_at" as SortField, dir: "desc" as SortDir, label: "Mais recentes" },
                    { field: "created_at" as SortField, dir: "asc" as SortDir, label: "Mais antigos" },
                    { field: "name" as SortField, dir: "asc" as SortDir, label: "Nome A→Z" },
                    { field: "name" as SortField, dir: "desc" as SortDir, label: "Nome Z→A" },
                    { field: "rating" as SortField, dir: "desc" as SortDir, label: "Maior avaliação" },
                    { field: "rating" as SortField, dir: "asc" as SortDir, label: "Menor avaliação" },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => { setSortField(opt.field); setSortDir(opt.dir); setShowSortMenu(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted ${sortField === opt.field && sortDir === opt.dir ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={filterRef} className="relative">
              <button 
                onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false); setShowBatchMenu(false); }}
                className={`px-3 py-1.5 border rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${activeFilters > 0 ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'}`}
              >
                Filtrar
                {activeFilters > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFilters}</span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-border rounded-xl shadow-lg z-30 w-60 py-2 overflow-hidden">
                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Status</p>
                  {[
                    { value: "ALL", label: "Todos" },
                    { value: "NEW", label: "Novo" },
                    { value: "READY", label: "Msg Pronta" },
                    { value: "QUEUED", label: "Na Fila" },
                    { value: "SENT", label: "Enviado" },
                    { value: "FAILED", label: "Falhou" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterStatus(opt.value as FilterStatus)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted ${filterStatus === opt.value ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                    >
                      {opt.label}
                    </button>
                  ))}

                  <div className="my-1.5 border-t border-border" />

                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Site</p>
                  {[
                    { value: "ALL", label: "Todos" },
                    { value: "YES", label: "Com site" },
                    { value: "NO", label: "Sem site" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFilterHasWebsite(opt.value as "ALL" | "YES" | "NO")}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted ${filterHasWebsite === opt.value ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                    >
                      {opt.label}
                    </button>
                  ))}

                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setFilterStatus("ALL"); setFilterHasWebsite("ALL"); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 flex items-center gap-1.5 mt-1 border-t border-border"
                    >
                      <X className="w-3.5 h-3.5" /> Limpar filtros
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {(search || activeFilters > 0) && (
          <div className="px-4 py-2 bg-white border-b border-border flex items-center gap-2 flex-wrap">
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted text-xs rounded-full font-medium">
                Busca: "{search}"
                <button onClick={() => setSearch("")} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterStatus !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                Status: {filterStatus}
                <button onClick={() => setFilterStatus("ALL")} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            )}
            {filterHasWebsite !== "ALL" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                {filterHasWebsite === "YES" ? "Com site" : "Sem site"}
                <button onClick={() => setFilterHasWebsite("ALL")} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{processedLeads.length} resultado{processedLeads.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="grid grid-cols-8 gap-4 p-4 border-b border-border text-xs font-semibold tracking-wider text-muted-foreground uppercase bg-muted/30">
          <div className="col-span-4">Lead</div>
          <div>Telefone</div>
          <div>Status</div>
          <div className="col-span-2 text-center">Ações</div>
        </div>

        <div className="divide-y divide-border relative min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : processedLeads.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
               {leads.length === 0 ? "Nenhum lead encontrado. Vá para a aba de Extração." : "Nenhum lead corresponde aos filtros aplicados."}
             </div>
          ) : (
            processedLeads.map((lead) => {
              const pipeline = getPipelineStatus(lead);
              const isGenerating = loadingLeadId === lead.id + '_ai';
              const isQueuing = loadingLeadId === lead.id + '_queue';

              return (
                <div 
                  key={lead.id} 
                  onClick={() => setSelectedLead(lead)}
                  className="grid grid-cols-8 gap-4 p-4 items-center text-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-medium text-foreground truncate">{lead.name}</span>
                      {lead.website ? (
                        <a 
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-blue-500 hover:underline truncate" 
                          onClick={e => e.stopPropagation()}
                        >
                          {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground truncate">Sem site</span>
                      )}
                    </div>
                  </div>

                  <div className="text-muted-foreground truncate">{lead.phone || "–"}</div>

                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${pipeline.color}`}>
                      {pipeline.label}
                    </span>
                  </div>

                  <div className="col-span-2 flex gap-2 justify-center items-center" onClick={e => e.stopPropagation()}>
                    {/* Botão de delete sempre visível no hover */}
                    <button
                      onClick={(e) => handleDeleteLead(e, lead)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      title="Apagar lead"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {(!lead.status_pipeline || lead.status_pipeline === 'NEW') && (
                      <button
                        onClick={(e) => handleGenerateMessage(e, lead)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors disabled:opacity-60"
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {isGenerating ? 'Gerando...' : 'Gerar IA'}
                      </button>
                    )}

                    {lead.status_pipeline === 'READY' && (
                      <>
                        <button
                          onClick={(e) => handleQueueLead(e, lead)}
                          disabled={isQueuing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
                        >
                          {isQueuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {isQueuing ? 'Enfileirando...' : 'Disparar'}
                        </button>
                        <button
                          onClick={(e) => handleManualSend(e, lead)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
                          title="Enviar manualmente pelo WhatsApp Web/App"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Manual
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

                    {lead.status_pipeline === 'QUEUED' && (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-amber-600">
                          <Clock className="w-3.5 h-3.5" /> Aguardando...
                        </span>
                        <button
                          onClick={(e) => handleManualSend(e, lead)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-200 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
                          title="Enviar manualmente pelo WhatsApp Web/App"
                        >
                          <Send className="w-3.5 h-3.5" /> Manual
                        </button>
                      </div>
                    )}
                    {lead.status_pipeline === 'SENT' && (
                      <div className="flex items-center gap-2">
                        <span className="hidden lg:flex items-center gap-1.5 text-xs text-green-600 mr-1" title="Mensagem enviada">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Enviada
                        </span>
                        <button
                          onClick={(e) => handleQueueLead(e, lead)}
                          disabled={isQueuing}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-60"
                          title="Disparar Novamente"
                        >
                          {isQueuing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Reenviar
                        </button>
                        <button
                          onClick={(e) => handleManualSend(e, lead)}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                          title="Enviar manualmente pelo WhatsApp Web/App"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Manual
                        </button>
                        <button
                          onClick={(e) => handleGenerateMessage(e, lead)}
                          disabled={isGenerating}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-purple-200 text-purple-600 text-xs font-medium hover:bg-purple-50 transition-colors disabled:opacity-60"
                          title="Gerar nova mensagem"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Refazer
                        </button>
                      </div>
                    )}
                    {lead.status_pipeline === 'FAILED' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleQueueLead(e, lead)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Tentar Novamente
                        </button>
                        <button
                          onClick={(e) => handleManualSend(e, lead)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-200 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
                          title="Enviar manualmente pelo WhatsApp Web/App"
                        >
                          <Send className="w-3.5 h-3.5" /> Manual
                        </button>
                      </div>
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
        onGenerateIA={(l) => handleGenerateMessage(null, l)}
        onQueueLead={(l) => handleQueueLead(null, l)}
        onConvertToClient={handleConvertToClient}
      />

      {isBatchProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl relative z-10 flex flex-col items-center text-center space-y-4 animate-in fade-in duration-200">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {batchProgress.type === 'AI' ? 'Gerando Mensagens IA' : 
                 batchProgress.type === 'CLEAR_QUEUE' ? 'Esvaziando Fila' :
                 batchProgress.type === 'DELETE' ? 'Apagando Leads' :
                 'Enfileirando Disparos'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Processando: <span className="font-semibold text-gray-900">{batchProgress.current}</span> de {batchProgress.total}
              </p>
            </div>
            
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-4">
              <div 
                className="bg-blue-600 h-full transition-all duration-300 ease-out"
                style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-400 mt-2">
              Processando sequencialmente para evitar bloqueios.<br/>
              Por favor, não feche esta aba.
            </p>
          </div>
        </div>
      )}

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
