"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function WhatsAppPage() {
  const [stats, setStats] = useState({ sent: 0, queued: 0, failed: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.from("leads").select("status_pipeline");
      if (!data) return;
      setStats({
        sent: data.filter(l => l.status_pipeline === "SENT").length,
        queued: data.filter(l => l.status_pipeline === "QUEUED" || l.status_pipeline === "SENDING").length,
        failed: data.filter(l => l.status_pipeline === "FAILED").length,
      });
    };
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Disparos WhatsApp</h1>
        <button className="px-4 py-2 border border-border bg-sidebar rounded-md text-sm font-medium hover:bg-muted transition-colors">
          Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-sidebar border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="w-4 h-4" /> Enviados
          </div>
          <span className="text-3xl font-bold">{stats.sent}</span>
        </div>
        <div className="bg-sidebar border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="w-4 h-4" /> Na Fila (Aguardando)
          </div>
          <span className="text-3xl font-bold">{stats.queued}</span>
        </div>
        <div className="bg-sidebar border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Falhas
          </div>
          <span className="text-3xl font-bold">{stats.failed}</span>
        </div>
      </div>

      <div className="bg-sidebar border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-white">
          <h2 className="font-medium text-lg">Fila de Disparos em Tempo Real</h2>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          A fila de processamento do n8n será renderizada aqui.
        </div>
      </div>
    </div>
  );
}
