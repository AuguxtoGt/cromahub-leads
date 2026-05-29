"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search,
  Send,
  QrCode,
  RefreshCcw,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Mic,
  Image as ImageIcon,
  FileText,
  Trash2,
} from "lucide-react";

// ─── Tipos ──────────────────────────────────────────────────
type Chat = {
  id: string;
  remote_jid: string;
  phone: string;
  phone_normalized: string;
  name: string;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
  chat_status: string;
  lead_id: string | null;
};

type Message = {
  id: string;
  chat_id: string;
  from_me: boolean;
  content: string;
  media_type: string;
  status: string;
  timestamp: string;
};

// ─── Helpers ─────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === "PENDING") return <Clock className="w-3 h-3 text-slate-400" />;
  if (status === "FAILED")  return <AlertCircle className="w-3 h-3 text-red-400" />;
  if (status === "SENT")    return <Check className="w-3 h-3 text-slate-400" />;
  if (status === "READ")    return <CheckCheck className="w-3 h-3 text-blue-500" />;
  return <CheckCheck className="w-3 h-3 text-slate-400" />; // DELIVERED
}

function MessageContent({ content, mediaType }: { content: string; mediaType: string }) {
  // ── Áudio ────────────────────────────────────────────────────
  if (mediaType === "AUDIO" || content.startsWith("[AUDIO] ")) {
    const src = content.startsWith("[AUDIO] ") ? content.substring(8) : content;
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Mic className="w-4 h-4 text-green-600" />
        </div>
        <audio
          src={src}
          controls
          className="h-8 flex-1"
          style={{ minWidth: 160 }}
          preload="metadata"
        />
      </div>
    );
  }

  // ── Imagem ───────────────────────────────────────────────────
  if (mediaType === "IMAGE" || content.startsWith("[IMAGE] ")) {
    const src = content.startsWith("[IMAGE] ") ? content.substring(8) : content;
    return (
      <div className="flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
        {src.startsWith("data:") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Imagem" className="max-w-[200px] rounded-md" />
        ) : (
          <span className="text-slate-500 text-xs">📷 Imagem</span>
        )}
      </div>
    );
  }

  // ── Arquivo ──────────────────────────────────────────────────
  if (mediaType === "FILE" || content.startsWith("📄")) {
    return (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="text-xs">{content}</span>
      </div>
    );
  }

  // ── Texto padrão ─────────────────────────────────────────────
  return <p className="whitespace-pre-wrap break-words">{content}</p>;
}

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatChatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─────────────────────────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<Chat | null>(null);

  // Mantém ref sincronizado para usar em closures do Realtime
  selectedChatRef.current = selectedChat;

  // ─── Auto-scroll para o final das mensagens ───────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Carrega lista de chats ───────────────────────────────
  const loadChats = useCallback(async () => {
    const { data } = await supabase
      .from("whatsapp_chats")
      .select("*")
      .order("last_message_at", { ascending: false });
    if (data) setChats(data as Chat[]);
  }, []);

  // ─── Carrega mensagens de um chat ────────────────────────
  const loadMessages = useCallback(async (chatId: string) => {
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("timestamp", { ascending: true });
    if (data) setMessages(data as Message[]);
  }, []);

  // ─── Verificação de conexão + Realtime de chats ──────────
  useEffect(() => {
    loadChats();

    const checkConnection = async () => {
      try {
        const response = await fetch("/api/whatsapp/instance", { method: "POST" });
        const data = await response.json();
        if (data.connected) {
          setIsConnected(true);
        } else if (data.qrcode) {
          setQrCode(data.qrcode);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsCheckingConnection(false);
      }
    };
    checkConnection();

    // Realtime: escuta mudanças na tabela de chats
    const chatSub = supabase
      .channel("realtime-whatsapp-chats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_chats" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setChats((prev) => [payload.new as Chat, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setChats((prev) =>
              prev
                .map((c) => (c.id === payload.new.id ? (payload.new as Chat) : c))
                .sort(
                  (a, b) =>
                    new Date(b.last_message_at).getTime() -
                    new Date(a.last_message_at).getTime()
                )
            );
          } else if (payload.eventType === "DELETE") {
            setChats((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
    };
  }, [loadChats]);

  // ─── Realtime de mensagens ao selecionar chat ────────────
  useEffect(() => {
    if (!selectedChat) return;

    loadMessages(selectedChat.id);

    // Zera contador de não-lidas
    if ((selectedChat.unread_count || 0) > 0) {
      supabase
        .from("whatsapp_chats")
        .update({ unread_count: 0 })
        .eq("id", selectedChat.id)
        .then(() => {
          setChats((prev) =>
            prev.map((c) =>
              c.id === selectedChat.id ? { ...c, unread_count: 0 } : c
            )
          );
        });
    }

    // Realtime: escuta novas mensagens neste chat
    const msgSub = supabase
      .channel(`realtime-messages-${selectedChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `chat_id=eq.${selectedChat.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              // Evita duplicatas
              if (prev.find((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new as Message];
            });
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.new.id ? (payload.new as Message) : m
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgSub);
    };
  }, [selectedChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Envio de mensagem ────────────────────────────────────
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || isSending) return;

    setIsSending(true);
    const text = newMessage.trim();
    setNewMessage("");

    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: selectedChat.id,
          remote_jid: selectedChat.remote_jid,
          text,
        }),
      });
    } catch (e) {
      console.error("Erro ao enviar:", e);
    } finally {
      setIsSending(false);
    }
  };

  // ─── Atualização de status do chat ───────────────────────
  const handleUpdateStatus = async (status: string) => {
    if (!selectedChat) return;
    await supabase
      .from("whatsapp_chats")
      .update({ chat_status: status })
      .eq("id", selectedChat.id);
    setSelectedChat({ ...selectedChat, chat_status: status });
  };

  // ─── Apagar Chat ───────────────────────────────────────────
  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    if (!window.confirm("Tem certeza que deseja apagar esta conversa e todas as suas mensagens? Essa ação não pode ser desfeita.")) return;

    try {
      await supabase.from("whatsapp_messages").delete().eq("chat_id", selectedChat.id);
      await supabase.from("whatsapp_chats").delete().eq("id", selectedChat.id);

      setChats((prev) => prev.filter((c) => c.id !== selectedChat.id));
      setSelectedChat(null);
      setMessages([]);
    } catch (e) {
      console.error("Erro ao apagar conversa:", e);
      alert("Erro ao apagar a conversa.");
    }
  };

  // ─── Gerar QR Code ────────────────────────────────────────
  const handleConnect = async () => {
    setIsLoadingQr(true);
    try {
      const response = await fetch("/api/whatsapp/instance", { method: "POST" });
      const data = await response.json();
      if (data.qrcode) setQrCode(data.qrcode);
      else if (data.connected) setIsConnected(true);
    } catch (e) {
      console.error(e);
    }
    setIsLoadingQr(false);
  };

  // ─── Forçar Desconexão ─────────────────────────────────────
  const handleForceDisconnect = async () => {
    if (!window.confirm("Deseja realmente desconectar? Isso apagará a sessão atual no servidor e exigirá um novo QR Code.")) return;
    setIsDisconnecting(true);
    try {
      await fetch("/api/whatsapp/instance", { method: "DELETE" });
      setIsConnected(false);
      setQrCode(null);
      // Recarrega o QR Code
      handleConnect();
    } catch (e) {
      console.error(e);
      alert("Erro ao desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ─── Filtragem ────────────────────────────────────────────
  const filteredChats = chats.filter((chat) => {
    const matchesFilter = filter === "ALL" || chat.chat_status === filter;
    const matchesSearch =
      !searchQuery ||
      chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.phone?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // ─── Estados de loading ───────────────────────────────────
  if (isCheckingConnection) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <RefreshCcw className="w-8 h-8 animate-spin text-green-500" />
          <p>Verificando conexão do WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl border border-border shadow-sm max-w-md w-full text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Conectar WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Escaneie o QR Code para conectar o seu chip de prospecção.
          </p>

          {isLoadingQr ? (
            <div className="w-56 h-56 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-slate-50">
              <RefreshCcw className="w-6 h-6 animate-spin text-green-500" />
            </div>
          ) : qrCode ? (
            <div className="p-4 bg-white border border-border rounded-lg shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCode}
                alt="WhatsApp QR Code"
                className="w-48 h-48"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Abra o WhatsApp → Dispositivos conectados → Conectar
              </p>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              Gerar QR Code
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // UI Principal — Chat
  // ─────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-130px)] flex bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* ── Sidebar — Lista de Chats ── */}
      <div className="w-80 border-r border-border flex flex-col bg-slate-50 flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border bg-white flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">Conversas</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleForceDisconnect}
              disabled={isDisconnecting}
              title="Forçar Desconexão (Limpar Sessão)"
              className="text-[10px] bg-red-100 text-red-600 hover:bg-red-200 px-2 py-1 rounded-md font-medium transition-colors"
            >
              {isDisconnecting ? "Saindo..." : "Sair"}
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-green-600 font-medium">Conectado</span>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Busca e filtros */}
        <div className="p-3 border-b border-border bg-white flex flex-col gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
            {["ALL", "UNANSWERED", "ANSWERED", "INTERESTED", "CLOSED"].map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    filter === f
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f === "ALL"
                    ? "Todos"
                    : f === "UNANSWERED"
                    ? "Não Resp."
                    : f === "ANSWERED"
                    ? "Respondido"
                    : f === "INTERESTED"
                    ? "Interessado"
                    : "Fechado"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`w-full text-left p-3 border-b border-border hover:bg-slate-100 flex gap-3 transition-colors ${
                selectedChat?.id === chat.id ? "bg-green-50" : "bg-white"
              }`}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-200 rounded-full flex-shrink-0 flex items-center justify-center text-green-700 font-semibold text-sm overflow-hidden">
                {chat.name?.substring(0, 2).toUpperCase() || "??"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-medium text-sm text-foreground truncate">
                    {chat.name || chat.phone}
                  </h3>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                    {formatChatTime(chat.last_message_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground truncate pr-2">
                    {chat.last_message_preview || "..."}
                  </p>
                  {(chat.unread_count || 0) > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex-shrink-0">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {filteredChats.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      {/* ── Área de Chat ── */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-[#efeae2] min-w-0">
          {/* Header do chat */}
          <div className="px-4 py-3 bg-white border-b border-border flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-200 rounded-full flex items-center justify-center text-green-700 font-semibold text-sm">
                {selectedChat.name?.substring(0, 2).toUpperCase() || "??"}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">
                  {selectedChat.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedChat.phone_normalized || selectedChat.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedChat.chat_status || "UNANSWERED"}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="text-xs font-medium bg-slate-100 border-none rounded-md px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-green-500"
              >
                <option value="UNANSWERED">Não Respondido</option>
                <option value="ANSWERED">Respondido</option>
                <option value="INTERESTED">Interessado</option>
                <option value="CLOSED">Fechado</option>
              </select>

              <button
                onClick={handleDeleteChat}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="Apagar conversa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.map((msg) => {
              const isMe = msg.from_me;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm text-sm ${
                      isMe
                        ? "bg-[#d9fdd3] text-slate-800 rounded-tr-none"
                        : "bg-white text-slate-800 rounded-tl-none"
                    }`}
                  >
                    <MessageContent
                      content={msg.content}
                      mediaType={msg.media_type || "TEXT"}
                    />
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-slate-500">
                        {formatTime(msg.timestamp)}
                      </span>
                      {isMe && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Âncora para auto-scroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de mensagem */}
          <div className="p-3 bg-slate-100 flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite uma mensagem"
              className="flex-1 resize-none max-h-32 min-h-[44px] p-3 rounded-lg border-none focus:ring-0 outline-none shadow-sm text-sm"
              rows={1}
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="p-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors shadow-sm flex-shrink-0"
            >
              {isSending ? (
                <RefreshCcw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 ml-0.5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <QrCode className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-light text-slate-600 mb-2">
            WhatsApp Conectado
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Selecione uma conversa ao lado para começar a conversar com seus
            leads.
          </p>
        </div>
      )}
    </div>
  );
}
