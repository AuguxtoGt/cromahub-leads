"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Briefcase, 
  Users, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  MessageSquare,
  Percent,
  Activity,
  Layers,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

interface Lead {
  id: string;
  status_pipeline: string | null;
  ai_message: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  price: number;
  due_day: number;
  last_payment_date: string | null;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [leadsRes, clientsRes] = await Promise.all([
        supabase.from("leads").select("id, status_pipeline, ai_message, created_at"),
        supabase.from("clients").select("id, name, price, due_day, last_payment_date")
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (clientsRes.error) throw clientsRes.error;

      setLeads(leadsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (e: any) {
      console.error("Erro ao carregar dados do dashboard:", e);
      toast.error("Erro ao carregar dados do dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Inscrição em tempo real para leads e clientes
    const leadsSub = supabase
      .channel("dashboard:leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchData();
      })
      .subscribe();

    const clientsSub = supabase
      .channel("dashboard:clients")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSub);
      supabase.removeChannel(clientsSub);
    };
  }, []);

  // Helper de status de cliente
  const getClientStatus = (client: Client): "PENDING" | "PAID" | "OVERDUE" => {
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

  // 1. Métricas Financeiras
  const financialMetrics = useMemo(() => {
    let mrr = 0;
    let paid = 0;
    let pending = 0;
    const overdueClients: Client[] = [];

    clients.forEach(client => {
      const price = parseFloat(client.price.toString()) || 0;
      mrr += price;
      const status = getClientStatus(client);

      if (status === "PAID") {
        paid += price;
      } else {
        pending += price;
        if (status === "OVERDUE") {
          overdueClients.push(client);
        }
      }
    });

    return {
      mrr,
      paid,
      pending,
      overdueCount: overdueClients.length,
      overdueList: overdueClients,
      clientCount: clients.length
    };
  }, [clients]);

  // 2. Métricas de Prospecção (Leads)
  const leadStats = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter(l => !l.status_pipeline || l.status_pipeline === "NEW").length;
    const prontos = leads.filter(l => l.status_pipeline === "READY").length;
    const fila = leads.filter(l => l.status_pipeline === "QUEUED" || l.status_pipeline === "SENDING").length;
    const enviados = leads.filter(l => l.status_pipeline === "SENT").length;
    const falhados = leads.filter(l => l.status_pipeline === "FAILED").length;
    const qualificados = leads.filter(l => l.ai_message).length; // IA gerada

    return {
      total,
      novos,
      prontos,
      fila,
      enviados,
      falhados,
      qualificados
    };
  }, [leads]);

  // Cálculo das taxas de conversão para o gráfico de funil
  const funnelSteps = useMemo(() => {
    const total = leadStats.total;
    const qualificados = leadStats.qualificados;
    const enviados = leadStats.enviados;
    const convertidos = financialMetrics.clientCount; // Conversão final aproximada

    const rateQual = total > 0 ? Math.round((qualificados / total) * 100) : 0;
    const rateEnv = qualificados > 0 ? Math.round((enviados / qualificados) * 100) : 0;
    const rateConv = enviados > 0 ? Math.round((convertidos / enviados) * 100) : 0;

    return [
      { name: "Extraídos", value: total, percent: 100, color: "bg-blue-600", desc: "Total do Maps" },
      { name: "Msg IA Pronta", value: qualificados, percent: rateQual, color: "bg-purple-600", desc: "Qualificados pela IA" },
      { name: "Mensagem Enviada", value: enviados, percent: rateEnv, color: "bg-amber-500", desc: "Disparos efetuados" },
      { name: "Clientes Fechados", value: convertidos, percent: rateConv, color: "bg-green-600", desc: "Conversão recorrente" }
    ];
  }, [leadStats, financialMetrics]);

  // Cálculos do gráfico Donut (SVG)
  const donutData = useMemo(() => {
    const total = financialMetrics.mrr;
    if (total === 0) return { paidDash: 0, pendingDash: 0, paidPct: 0, pendingPct: 0 };

    const paidPct = (financialMetrics.paid / total) * 100;
    const pendingPct = (financialMetrics.pending / total) * 100;

    // Para stroke-dasharray no círculo de raio 40 (perímetro = 2 * PI * r = 251.3)
    const paidDash = (paidPct / 100) * 251.3;
    const pendingDash = (pendingPct / 100) * 251.3;

    return {
      paidDash,
      pendingDash,
      paidPct: Math.round(paidPct),
      pendingPct: Math.round(pendingPct)
    };
  }, [financialMetrics]);

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
        <div className="text-center space-y-2">
          <Activity className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando painel analítico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Estatísticas financeiras e funil de conversão de leads.</p>
        </div>
      </div>

      {/* Cards Financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { 
            title: "Clientes Ativos", 
            value: financialMetrics.clientCount.toString(), 
            icon: Users,
            color: "text-blue-600 bg-blue-50 border-blue-100" 
          },
          { 
            title: "Mensalidade (MRR)", 
            value: financialMetrics.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
            icon: DollarSign,
            color: "text-indigo-600 bg-indigo-50 border-indigo-100" 
          },
          { 
            title: "Recebido este Mês", 
            value: financialMetrics.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
            icon: TrendingUp,
            color: "text-green-600 bg-green-50 border-green-100" 
          },
          { 
            title: "Pendente este Mês", 
            value: financialMetrics.pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 
            icon: Clock,
            color: "text-amber-600 bg-amber-50 border-amber-100" 
          },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="bg-sidebar border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">{card.title}</span>
                <span className="text-2xl font-bold tracking-tight text-foreground block">{card.value}</span>
              </div>
              <div className={`p-3 rounded-lg border ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Seção de Gráficos e Funil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico do Funil de Leads */}
        <div className="lg:col-span-2 bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Funil de Conversão da Prospecção
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Fluxo de captação e taxas de conversão entre etapas.</p>
          </div>

          <div className="space-y-5 my-4">
            {funnelSteps.map((step, index) => (
              <div key={step.name} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
                    {step.name}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-bold text-foreground">{step.value}</span> ({step.desc})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-muted h-3.5 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full ${step.color} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: `${step.percent}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-10 text-right">
                    {step.percent}%
                  </span>
                </div>
                {index > 0 && step.value > 0 && (
                  <div className="text-[10px] text-muted-foreground pl-4 flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    Aproveitamento de <span className="font-bold text-foreground">{step.percent}%</span> a partir da etapa anterior.
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4 mt-2 flex justify-between text-xs text-muted-foreground">
            <span>Conversão Total (Extraídos ➔ Fechados):</span>
            <span className="font-bold text-foreground">
              {leadStats.total > 0 ? ((financialMetrics.clientCount / leadStats.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        {/* Faturamento e Pagamentos (Donut Chart) */}
        <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              Faturamento do Mês
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Percentual recebido versus cobranças pendentes.</p>
          </div>

          <div className="relative flex justify-center items-center my-6">
            {financialMetrics.mrr === 0 ? (
              <div className="w-40 h-40 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                Nenhum cliente cadastrado no momento.
              </div>
            ) : (
              <>
                {/* SVG Donut Chart */}
                <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-muted"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Segmento Recebido (Green) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-green-500 transition-all duration-1000"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 - donutData.paidDash}
                  />
                  {/* Segmento Pendente (Amber) */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-amber-500 transition-all duration-1000"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 - donutData.pendingDash}
                    // O offset rotaciona para começar exatamente onde o verde termina
                    style={{ transform: `rotate(${(donutData.paidPct / 100) * 360}deg)`, transformOrigin: '50px 50px' }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Total MRR</span>
                  <span className="text-lg font-bold text-foreground">
                    {financialMetrics.mrr.toLocaleString('pt-BR', { notation: 'compact', compactDisplay: 'short' })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Legenda do Donut */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="w-3 h-3 rounded bg-green-500 shrink-0" />
                Recebido
              </span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{donutData.paidPct}%</span> | {financialMetrics.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                Pendente / Vencido
              </span>
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{donutData.pendingPct}%</span> | {financialMetrics.pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Operações & Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Operacional de Disparos */}
        <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              Status de Disparos
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Resumo operacional de entregas via WhatsApp.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            {[
              { label: "Novos", val: leadStats.novos, color: "border-blue-100 bg-blue-50/50 text-blue-600" },
              { label: "Msg Pronta", val: leadStats.prontos, color: "border-purple-100 bg-purple-50/50 text-purple-600" },
              { label: "Na Fila", val: leadStats.fila, color: "border-amber-100 bg-amber-50/50 text-amber-600" },
              { label: "Enviados", val: leadStats.enviados, color: "border-green-100 bg-green-50/50 text-green-600" },
              { label: "Falhados", val: leadStats.falhados, color: "border-red-100 bg-red-50/50 text-red-600" },
              { label: "Total Leads", val: leadStats.total, color: "border-gray-200 bg-gray-50/50 text-gray-700" }
            ].map(item => (
              <div key={item.label} className={`border rounded-lg p-3 text-center ${item.color}`}>
                <span className="text-[10px] font-semibold uppercase tracking-wider block text-muted-foreground">{item.label}</span>
                <span className="text-xl font-bold block mt-1 text-inherit">{item.val}</span>
              </div>
            ))}
          </div>
          
          <div className="text-[10px] text-muted-foreground text-center pt-2 border-t border-border">
            Última extração realizada em tempo real.
          </div>
        </div>

        {/* Clientes em Atraso (Alertas) */}
        <div className="lg:col-span-2 bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Alertas de Cobrança (Atrasados)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Clientes cuja mensalidade já venceu no mês atual.</p>
          </div>

          <div className="flex-1 my-4 overflow-y-auto max-h-[160px] custom-scrollbar">
            {financialMetrics.overdueList.length === 0 ? (
              <div className="h-full flex items-center justify-center flex-col gap-2 text-muted-foreground p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <span className="text-sm font-semibold text-foreground">Tudo em dia!</span>
                <span className="text-xs">Nenhum cliente está com mensalidade atrasada este mês.</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {financialMetrics.overdueList.map(client => (
                  <div key={client.id} className="py-2.5 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold text-foreground block">{client.name}</span>
                      <span className="text-xs text-muted-foreground block">
                        Venceu dia {client.due_day} | Preço: {client.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <a 
                      href={`/clients`}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-xs font-semibold hover:bg-red-100 transition-colors border border-red-100 flex items-center gap-1"
                    >
                      Cobrar Cliente
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3 mt-1 flex justify-between text-xs text-muted-foreground">
            <span>Total Atrasados:</span>
            <span className="font-bold text-red-600">{financialMetrics.overdueCount} cliente{financialMetrics.overdueCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
