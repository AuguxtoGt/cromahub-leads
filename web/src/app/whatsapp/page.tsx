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
  Wifi,
  WifiOff,
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
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
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

    // Verificação inicial LEVE: só checa se já está conectado (GET), sem criar instância.
    // O usuário deve clicar em "Gerar QR Code" para iniciar a conexão.
    const checkConnection = async () => {
      try {
        const response = await fetch("/api/whatsapp/instance", { method: "GET" });
        const data = await response.json();
        if (data.connected) {
          setIsConnected(true);
        }
        // Se não conectado, simplesmente mostra o botão de "Gerar QR Code"
      } catch (e) {
        console.error(e);
      } finally {
        setIsCheckingConnection(false);
      }
    };
    checkConnection();

    // ─── Polling de status a cada 60s ─────────────────────────
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setConnectionStatus(data.connected ? 'online' : 'offline');
        setLastChecked(new Date());
        // Se ficou offline, atualiza o estado principal também
        if (!data.connected) setIsConnected(false);
      } catch {
        setConnectionStatus('offline');
      }
    };

    // Espera 3s para o checkConnection inicial terminar antes de começar o polling
    const pollTimeout = setTimeout(() => {
      pollStatus(); // primeira verificação
      const interval = setInterval(pollStatus, 60_000); // depois a cada 60s
      return () => clearInterval(interval);
    }, 3000);

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

    // Realtime: escuta mudanças no status da conexão no banco
    const statusSub = supabase
      .channel("realtime-whatsapp-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "settings" },
        (payload) => {
          if (payload.new.whatsapp_status) {
             const isOnline = payload.new.whatsapp_status === 'open';
             setConnectionStatus(isOnline ? 'online' : 'offline');
             if (isOnline) setIsConnected(true);
             else setIsConnected(false);
             setLastChecked(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(pollTimeout);
      supabase.removeChannel(chatSub);
      supabase.removeChannel(statusSub);
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
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: selectedChat.id,
          remote_jid: selectedChat.remote_jid,
          text,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao enviar a mensagem. Verifique se o número é válido no WhatsApp.");
      }
    } catch (e) {
      console.error("Erro ao enviar:", e);
      alert("Erro ao enviar a mensagem.");
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
    setQrError(null);
    try {
      const response = await fetch("/api/whatsapp/instance", { method: "POST" });
      const data = await response.json();
      if (data.qrcode) {
        setQrCode(data.qrcode);
      } else if (data.connected) {
        setIsConnected(true);
      } else {
        setQrError(data.error || 'Não foi possível gerar o QR Code. Verifique se a Evolution API está online e tente novamente.');
      }
    } catch (e) {
      console.error(e);
      setQrError('Erro de conexão. Verifique sua internet e tente novamente.');
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
            <div className="w-56 h-56 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-slate-50 flex-col gap-3">
              <RefreshCcw className="w-6 h-6 animate-spin text-green-500" />
              <p className="text-xs text-muted-foreground text-center px-4">
                Aguardando WhatsApp API...<br />
                <span className="text-xs text-slate-400">(pode levar até 20 segundos)</span>
              </p>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white border border-border rounded-lg shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Abra o WhatsApp → Dispositivos conectados → Conectar
              </p>
              <button
                onClick={handleConnect}
                className="text-xs text-green-600 hover:text-green-700 underline"
              >
                QR Code expirou? Gerar novo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {qrError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 text-left max-w-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{qrError}</span>
                </div>
              )}
              <button
                onClick={handleConnect}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
              >
                {qrError ? 'Tentar novamente' : 'Gerar QR Code'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // UI Principal — Conectado
  // ─────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl border border-border shadow-sm max-w-md w-full text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          WhatsApp Conectado
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Seu número está conectado e pronto para realizar os disparos automáticos de prospecção.
        </p>
        
        <div className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-border mb-6">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700">Status</span>
          </div>
          <div className="flex items-center gap-1.5" title={lastChecked ? `Última verificação: ${lastChecked.toLocaleTimeString('pt-BR')}` : 'Verificando...'}>
            {connectionStatus === 'online' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-600 font-medium">Online e operando</span>
              </>
            ) : connectionStatus === 'offline' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm text-red-500 font-medium">Offline</span>
              </>
            ) : (
              <>
                <RefreshCcw className="w-3 h-3 text-slate-400 animate-spin" />
                <span className="text-sm text-slate-400 font-medium">Verificando...</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleForceDisconnect}
          disabled={isDisconnecting}
          className="px-6 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors border border-red-200 w-full"
        >
          {isDisconnecting ? "Desconectando..." : "Desconectar WhatsApp"}
        </button>
      </div>
    </div>
  );
}
