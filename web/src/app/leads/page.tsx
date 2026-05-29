"use client";

import { useState, useEffect, useRef } from "react";
import { SlideOver } from "@/components/ui/SlideOver";
import { supabase } from "@/lib/supabase";
import { Loader2, Sparkles, Send, CheckCircle2, Clock, AlertCircle, ChevronDown, X } from "lucide-react";

type SortField = "created_at" | "name" | "rating";
type SortDir = "desc" | "asc";
type FilterStatus = "ALL" | "NEW" | "READY" | "QUEUED" | "SENT" | "FAILED";

export default function LeadsPage() {
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterHasWebsite, setFilterHasWebsite] = useState<"ALL" | "YES" | "NO">("ALL");
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterMenu(false);
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

  // ── Filtering + Sorting (client-side) ──────────────────────────────
  const processedLeads = leads
    .filter(l => {
      // search
      if (search) {
        const q = search.toLowerCase();
        const match = (l.name || "").toLowerCase().includes(q) ||
          (l.phone || "").includes(q) ||
          (l.city || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      // status filter
      if (filterStatus !== "ALL") {
        const status = l.status_pipeline || "NEW";
        if (filterStatus === "NEW" && status !== "NEW" && status !== null && status !== undefined && status !== "") return false;
        if (filterStatus !== "NEW" && status !== filterStatus) return false;
      }
      // website filter
      if (filterHasWebsite === "YES" && !l.website) return false;
      if (filterHasWebsite === "NO" && l.website) return false;
      return true;
    })
    .sort((a, b) => {
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
  };

  // Count active filters
  const activeFilters = (filterStatus !== "ALL" ? 1 : 0) + (filterHasWebsite !== "ALL" ? 1 : 0);

  const sortLabels: Record<string, string> = {
    "created_at_desc": "Mais recentes",
    "created_at_asc": "Mais antigos",
    "name_asc": "Nome A→Z",
    "name_desc": "Nome Z→A",
    "rating_desc": "Maior avaliação",
    "rating_asc": "Menor avaliação",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Leads</h1>
        <div className="flex gap-3">
          <button 
            onClick={fetchLeads}
            className="px-4 py-2 border border-border bg-sidebar rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            Atualizar
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
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-64 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            {/* Sort Dropdown */}
            <div ref={sortRef} className="relative">
              <button 
                onClick={() => { setShowSortMenu(v => !v); setShowFilterMenu(false); }}
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

            {/* Filter Dropdown */}
            <div ref={filterRef} className="relative">
              <button 
                onClick={() => { setShowFilterMenu(v => !v); setShowSortMenu(false); }}
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
                  {/* Status filter */}
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

                  {/* Site filter */}
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

        {/* Active filter chips */}
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
                  {/* Nome */}
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 shrink-0">
                      {lead.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-medium text-foreground truncate">{lead.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.website ? 'Tem site' : 'Sem site'}
                      </span>
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className="text-muted-foreground truncate">{lead.phone || "–"}</div>

                  {/* Canal */}
                  <div className="text-muted-foreground">Google Maps</div>

                  {/* Status Pipeline */}
                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${pipeline.color}`}>
                      {pipeline.label}
                    </span>
                  </div>

                  {/* Data */}
                  <div className="text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </div>

                  {/* Ações */}
                  <div className="col-span-2 flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
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
      />
    </div>
  );
}
