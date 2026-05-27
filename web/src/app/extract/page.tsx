"use client";

import { useState } from "react";
import { MapPin, Search, Play, Loader2, Lightbulb } from "lucide-react";
import { NichesModal } from "@/components/ui/NichesModal";

export default function ExtractPage() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [filterNoWebsite, setFilterNoWebsite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info'|'success'|'error'}[]>([
    { time: new Date().toLocaleTimeString(), msg: "Aguardando configuração de busca...", type: "info" }
  ]);

  const addLog = (msg: string, type: 'info'|'success'|'error' = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }]);
  };

  const handleExtract = async () => {
    if (!keyword || !location) {
      addLog("Erro: Preencha o nicho e a localização.", "error");
      return;
    }

    setIsLoading(true);
    addLog(`Iniciando extração para: ${keyword} em ${location}...`, "info");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, location, filterNoWebsite })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro desconhecido na extração");
      }

      addLog(`🏁 EXTRAÇÃO CONCLUÍDA COM SUCESSO!`, "success");
      addLog(`📊 TOTAL EXTRAÍDO AGORA: ${data.leads?.length || 0} leads processados.`, "success");
      addLog(data.message, "info");

    } catch (err: any) {
      addLog(`Erro: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Extração Inteligente</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Formulário de Busca */}
        <div className="col-span-1 space-y-4">
          <div className="bg-sidebar border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="font-medium text-lg">Nova Busca</h2>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Ideias de Nichos
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Nicho / Palavra-chave</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    type="text" 
                    placeholder="Ex: Dentistas, Restaurantes..." 
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Localização</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <input 
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    type="text" 
                    placeholder="Ex: São Paulo, SP" 
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Filtros Avançados</label>
                <div className="flex items-center gap-2 border border-border rounded-md p-2">
                  <input 
                    checked={filterNoWebsite}
                    onChange={(e) => setFilterNoWebsite(e.target.checked)}
                    type="checkbox" 
                    id="no-website" 
                    className="rounded" 
                  />
                  <label htmlFor="no-website" className="text-sm cursor-pointer">Apenas empresas SEM site</label>
                </div>
              </div>

              <button 
                onClick={handleExtract}
                disabled={isLoading}
                className="w-full mt-2 bg-primary text-white py-2.5 rounded-md font-medium shadow-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} 
                {isLoading ? "Extraindo..." : "Iniciar Extração"}
              </button>
            </div>
          </div>
        </div>

        {/* Console / Status */}
        <div className="col-span-2">
          <div className="bg-sidebar border border-border rounded-xl p-5 shadow-sm flex flex-col h-[600px]">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-4 shrink-0">
              <h2 className="font-medium text-lg">Console de Execução</h2>
              <span className={`px-2 py-1 text-xs rounded-full font-medium border ${isLoading ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                {isLoading ? 'Processando' : 'Pronto'}
              </span>
            </div>
            
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm space-y-2 overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-red-400' : 
                    log.type === 'success' ? 'text-emerald-400' : 
                    'text-blue-400'
                  }>
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <NichesModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
