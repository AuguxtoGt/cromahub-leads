"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Briefcase, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  RefreshCcw, 
  ExternalLink, 
  DollarSign, 
  MessageSquare,
  Filter,
  CreditCard
} from "lucide-react";

// Client Data Model
interface Client {
  id: string;
  name: string;
  domain: string | null;
  phone: string | null;
  price: number;
  setup_price: number | null;
  due_day: number;
  created_at: string;
  last_payment_date: string | null;
  notes: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDueDay, setSelectedDueDay] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "PAID" | "PENDING" | "OVERDUE">("all");

  // Modals state
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [chargingClient, setChargingClient] = useState<Client | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    domain: "",
    phone: "",
    price: "",
    setup_price: "",
    due_day: 10,
    notes: ""
  });

  // Charge template state
  const [selectedTemplate, setSelectedTemplate] = useState<"reminder" | "today" | "late">("reminder");
  const [customMessage, setCustomMessage] = useState("");

  // Load clients from Supabase
  const loadClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      if (data) setClients(data);
    } catch (e) {
      console.error("Erro ao carregar clientes:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Helper to dynamically calculate client's payment status for current month
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

  // Form field mapping when editing
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      domain: client.domain || "",
      phone: client.phone || "",
      price: client.price.toString(),
      setup_price: client.setup_price?.toString() || "",
      due_day: client.due_day,
      notes: client.notes || ""
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({
      name: "",
      domain: "",
      phone: "",
      price: "39.90",
      setup_price: "297.00",
      due_day: 10,
      notes: ""
    });
    setIsAddEditModalOpen(true);
  };

  // Handle CRUD submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.due_day) return;
    setIsSubmitLoading(true);

    const payload = {
      name: formData.name,
      domain: formData.domain || null,
      phone: formData.phone || null,
      price: parseFloat(formData.price) || 0,
      setup_price: formData.setup_price ? parseFloat(formData.setup_price) : null,
      due_day: parseInt(formData.due_day.toString()),
      notes: formData.notes || null
    };

    try {
      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingClient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clients")
          .insert([payload]);
        if (error) throw error;
      }

      setIsAddEditModalOpen(false);
      loadClients();
    } catch (e) {
      console.error("Erro ao salvar cliente:", e);
      alert("Erro ao salvar cliente. Verifique as credenciais ou campos.");
    } finally {
      setIsSubmitLoading(false);
    }
  };

  // Handle Client Delete
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este cliente?")) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) throw error;
      loadClients();
    } catch (e) {
      console.error("Erro ao deletar cliente:", e);
    }
  };

  // Toggle/Confirm Payment
  const handleTogglePayment = async (client: Client, currentStatus: "PAID" | "PENDING" | "OVERDUE") => {
    try {
      const today = new Date();
      // Salva a data no horário local (não UTC) para evitar que a virada do mês
      // em fuso horário brasileiro (UTC-3) cause inconsistências na comparação de mês
      const localIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T12:00:00.000Z`;
      const updatedDate = currentStatus === "PAID" ? null : localIso;

      const { error } = await supabase
        .from("clients")
        .update({ last_payment_date: updatedDate })
        .eq("id", client.id);

      if (error) throw error;
      loadClients();
    } catch (e) {
      console.error("Erro ao atualizar pagamento:", e);
    }
  };

  // Calculate charging message based on template selection
  const updateMessageText = (client: Client, templateType: "reminder" | "today" | "late") => {
    const today = new Date();
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const currentMonthName = monthNames[today.getMonth()];
    const formattedPrice = `R$ ${client.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    let text = "";
    if (templateType === "reminder") {
      text = `Olá, ${client.name}! Tudo bem?\n\nPassando para lembrar que a mensalidade de manutenção do seu site (${client.domain || 'site'}) vence no dia ${client.due_day} de ${currentMonthName}.\n\nO valor é de ${formattedPrice}. Qualquer dúvida ou se precisar do Pix, estou por aqui! Abraços.`;
    } else if (templateType === "today") {
      text = `Oi, ${client.name}! Tudo bem?\n\nLembrete amigável: hoje vence a mensalidade de manutenção do seu site (${client.domain || 'site'}), no valor de ${formattedPrice}.\n\nSe já tiver realizado o Pix, pode desconsiderar essa mensagem ou me enviar o comprovante. Muito obrigado!`;
    } else {
      text = `Olá, ${client.name}! Espero que esteja bem.\n\nNotei que a mensalidade da manutenção do seu site (${client.domain || 'site'}) referente a ${currentMonthName}, que venceu no dia ${client.due_day}, ainda consta em aberto no meu sistema.\n\nO valor é de ${formattedPrice}. Consegue verificar para mim se já foi feito o pagamento, por favor? Obrigado pela atenção!`;
    }
    setCustomMessage(text);
  };

  // Open Charge Modal
  const handleOpenCharge = (client: Client) => {
    setChargingClient(client);
    setSelectedTemplate("reminder");
    updateMessageText(client, "reminder");
    setIsChargeModalOpen(true);
  };

  // Template switch inside modal
  const handleTemplateChange = (templateType: "reminder" | "today" | "late") => {
    setSelectedTemplate(templateType);
    if (chargingClient) {
      updateMessageText(chargingClient, templateType);
    }
  };

  // Open WhatsApp Link
  const handleSendCharge = () => {
    if (!chargingClient) return;
    
    // Clean phone number (leave only digits and format properly)
    let phone = chargingClient.phone || "";
    phone = phone.replace(/\D/g, "");
    
    // Add Brazil country code if not present
    if (phone.length === 10 || phone.length === 11) {
      phone = `55${phone}`;
    }

    const encodedText = encodeURIComponent(customMessage);
    const waUrl = `https://wa.me/${phone}?text=${encodedText}`;
    
    window.open(waUrl, "_blank");
    setIsChargeModalOpen(false);
  };

  // Process and Filter clients locally
  const processedClients = useMemo(() => {
    return clients.map(client => ({
      ...client,
      status: getClientStatus(client)
    })).filter(client => {
      // 1. Search Query Filter
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        client.name.toLowerCase().includes(query) || 
        (client.domain && client.domain.toLowerCase().includes(query)) ||
        (client.phone && client.phone.includes(query));

      // 2. Due Day Filter
      const matchesDueDay = selectedDueDay === "all" || client.due_day.toString() === selectedDueDay;

      // 3. Status Filter
      const matchesStatus = statusFilter === "all" || client.status === statusFilter;

      return matchesSearch && matchesDueDay && matchesStatus;
    });
  }, [clients, searchQuery, selectedDueDay, statusFilter]);

  // Calculate Dashboard Metrics
  const metrics = useMemo(() => {
    let activeMRR = 0;
    let receivedThisMonth = 0;
    let pendingThisMonth = 0;
    let overdueThisMonth = 0;

    clients.forEach(client => {
      const status = getClientStatus(client);
      activeMRR += client.price;

      if (status === "PAID") {
        receivedThisMonth += client.price;
      } else if (status === "PENDING") {
        pendingThisMonth += client.price;
      } else if (status === "OVERDUE") {
        overdueThisMonth += client.price;
      }
    });

    return {
      activeMRR,
      receivedThisMonth,
      pendingThisMonth,
      overdueThisMonth,
      totalClients: clients.length
    };
  }, [clients]);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestão de Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">Gerencie seus clientes fechados, acompanhe faturamentos mensais e controle a cobrança de recorrência.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadClients}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors bg-white shadow-sm"
            title="Atualizar dados"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
          >
            <Plus className="w-5 h-5" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Active MRR */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faturamento Recorrente (MRR)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">
                R$ {metrics.activeMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4">
            Total de <span className="font-semibold text-slate-700">{metrics.totalClients}</span> clientes ativos
          </div>
        </div>

        {/* Received This Month */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recebido este Mês</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-2">
                R$ {metrics.receivedThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Fluxo de caixa saudável
          </div>
        </div>

        {/* Pending This Month */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">A Receber (Pendente)</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-2">
                R$ {metrics.pendingThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4">
            Dentro da data do vencimento
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inadimplência (Atrasados)</p>
              <h3 className="text-2xl font-bold text-rose-600 mt-2">
                R$ {metrics.overdueThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xs text-rose-500 mt-4 font-medium">
            Exige atenção e contato
          </div>
        </div>

      </div>

      {/* Filter and Search Bar Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full lg:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por cliente, site, telefone..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          
          {/* Due Day Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={selectedDueDay}
              onChange={(e) => setSelectedDueDay(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
            >
              <option value="all">Todos os Vencimentos</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>Dia {day}</option>
              ))}
            </select>
          </div>

          {/* Status Tabs */}
          <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 w-full sm:w-auto overflow-hidden">
            <button 
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setStatusFilter("PAID")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${statusFilter === "PAID" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              Pagos
            </button>
            <button 
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${statusFilter === "PENDING" ? "bg-white text-amber-500 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              Pendentes
            </button>
            <button 
              onClick={() => setStatusFilter("OVERDUE")}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${statusFilter === "OVERDUE" ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
            >
              Atrasados
            </button>
          </div>

        </div>

      </div>

      {/* Main Clients Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
            <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Carregando lista de clientes...</p>
          </div>
        ) : processedClients.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3 bg-slate-50/50">
            <Briefcase className="w-12 h-12 text-slate-300" />
            <h3 className="font-semibold text-slate-600">Nenhum cliente encontrado</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1">Experimente mudar o filtro de status ou cadastre um novo cliente para começar a controlar as cobranças.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Cliente / Domínio</th>
                  <th className="py-4 px-6">Vencimento</th>
                  <th className="py-4 px-6">Valores (Setup / Recorrência)</th>
                  <th className="py-4 px-6">Status este Mês</th>
                  <th className="py-4 px-6">Ações Rápidas</th>
                  <th className="py-4 px-6 text-right">Gerenciar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {processedClients.map((client) => {
                  const status = client.status;
                  
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Domain */}
                      <td className="py-4 px-6">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-[15px]">{client.name}</h4>
                          {client.domain ? (
                            <a 
                              href={`https://${client.domain}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1.5 mt-1 font-medium group"
                            >
                              {client.domain}
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sem site associado</span>
                          )}
                        </div>
                      </td>

                      {/* Due Day */}
                      <td className="py-4 px-6">
                        <div className="font-medium text-slate-700">Todo dia {client.due_day}</div>
                        {client.last_payment_date && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            Último: {new Date(client.last_payment_date).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>

                      {/* Values */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-semibold">R$ {client.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<span className="text-[10px] text-slate-500 font-normal"> /mês</span></span>
                          {client.setup_price !== null && client.setup_price > 0 && (
                            <span className="text-xs text-slate-400">Setup: R$ {client.setup_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          )}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-6">
                        {status === "PAID" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Pago
                          </span>
                        )}
                        {status === "PENDING" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Pendente
                          </span>
                        )}
                        {status === "OVERDUE" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 rounded-full border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Atrasado
                          </span>
                        )}
                      </td>

                      {/* Confirm/Toggle and Charge Actions */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          
                          {/* Toggle Payment Confirm Button */}
                          <button
                            onClick={() => handleTogglePayment(client, status)}
                            className={`flex items-center justify-center p-2 rounded-lg border transition-all ${
                              status === "PAID" 
                                ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                            }`}
                            title={status === "PAID" ? "Marcar como pendente" : "Confirmar pagamento do mês"}
                          >
                            <Check className="w-4 h-4" />
                          </button>

                          {/* WhatsApp Charge Button */}
                          {client.phone ? (
                            <button
                              onClick={() => handleOpenCharge(client)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors shadow-sm"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              Cobrar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic" title="Cadastre um telefone para cobrar">Sem telefone</span>
                          )}

                        </div>
                      </td>

                      {/* CRUD Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleOpenEdit(client)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-md transition-colors"
                            title="Editar Cliente"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(client.id)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-rose-600 rounded-md transition-colors"
                            title="Excluir Cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-900">
                {editingClient ? "Editar Cliente" : "Adicionar Novo Cliente"}
              </h3>
              <button 
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
                
                {/* Nome */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nome do Cliente *</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Carlos Construtora"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Domínio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Domínio (Site)</label>
                  <input 
                    type="text"
                    value={formData.domain}
                    onChange={(e) => setFormData({...formData, domain: e.target.value})}
                    placeholder="Ex: carlosconstrucoes.com.br"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* WhatsApp */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">WhatsApp / Telefone</label>
                  <input 
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="Ex: 11999998888"
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Pricing Group */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Setup Price */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Taxa de Criação (Setup)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={formData.setup_price}
                      onChange={(e) => setFormData({...formData, setup_price: e.target.value})}
                      placeholder="Ex: 297.00"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Monthly Price */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-600">Mensalidade Recorrente *</label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      placeholder="Ex: 39.90"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    />
                  </div>

                </div>

                {/* Due Day */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Dia de Vencimento *</label>
                  <select 
                    value={formData.due_day}
                    onChange={(e) => setFormData({...formData, due_day: parseInt(e.target.value)})}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>Dia {day}</option>
                    ))}
                  </select>
                </div>

                {/* Notas/Notas */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">Notas / Observações</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Contrato firmado de 12 meses, Pix preferencial do cliente..."
                    rows={3}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                  {isSubmitLoading && <RefreshCcw className="w-4 h-4 animate-spin" />}
                  {editingClient ? "Salvar Alterações" : "Salvar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Personal Charge Modal */}
      {isChargeModalOpen && chargingClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Cobrar Cliente</h3>
                <p className="text-xs text-slate-500 mt-0.5">Envia uma mensagem amigável via seu WhatsApp pessoal para {chargingClient.name}</p>
              </div>
              <button 
                onClick={() => setIsChargeModalOpen(false)}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              
              {/* Template Select tabs */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-600">Escolha um Modelo de Mensagem:</label>
                <div className="grid grid-cols-3 gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
                  <button 
                    onClick={() => handleTemplateChange("reminder")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedTemplate === "reminder" ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    1. Pré-Vencimento
                  </button>
                  <button 
                    onClick={() => handleTemplateChange("today")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedTemplate === "today" ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    2. Vence Hoje
                  </button>
                  <button 
                    onClick={() => handleTemplateChange("late")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${selectedTemplate === "late" ? "bg-white text-slate-900 shadow-sm border border-slate-100" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    3. Cobrança/Atrasado
                  </button>
                </div>
              </div>

              {/* Message preview editor */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 flex justify-between">
                  <span>Mensagem (Você pode editar antes de abrir o WhatsApp):</span>
                  <span className="text-slate-400 font-normal">Destinatário: {chargingClient.phone}</span>
                </label>
                <textarea 
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={8}
                  className="w-full p-4 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-sans"
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Isso abrirá uma nova aba em seu WhatsApp Web pessoal.</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsChargeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSendCharge}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors text-sm flex items-center gap-1.5 shadow-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  Abrir WhatsApp
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
