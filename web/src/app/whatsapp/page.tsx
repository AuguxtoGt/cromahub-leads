"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, MoreVertical, Paperclip, Send, QrCode, RefreshCcw, Check, CheckCheck } from "lucide-react";
import Image from "next/image";

export default function WhatsAppPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [filter, setFilter] = useState("ALL");

  const loadChats = async () => {
    const { data } = await supabase
      .from('whatsapp_chats')
      .select('*')
      .order('last_message_at', { ascending: false });
    
    if (data) setChats(data);
  };

  const loadMessages = async (chatId: string) => {
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('timestamp', { ascending: true });
    
    if (data) setMessages(data);
  };

  useEffect(() => {
    loadChats();
    
    // Check if we are already connected
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/whatsapp/instance', { method: 'POST' });
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

    const chatSub = supabase
      .channel('public:whatsapp_chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => {
        loadChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatSub);
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      
      if (selectedChat.unread_count > 0) {
        supabase.from('whatsapp_chats')
          .update({ unread_count: 0 })
          .eq('id', selectedChat.id)
          .then(() => {
            setChats(prev => prev.map(c => c.id === selectedChat.id ? { ...c, unread_count: 0 } : c));
            setSelectedChat(prev => prev ? { ...prev, unread_count: 0 } : prev);
          });
      }
      
      const msgSub = supabase
        .channel(`public:whatsapp_messages:chat_id=eq.${selectedChat.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selectedChat.id}` }, () => {
          loadMessages(selectedChat.id);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(msgSub);
      };
    }
  }, [selectedChat]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    try {
      setNewMessage("");
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: selectedChat.id,
          remote_jid: selectedChat.remote_jid,
          text: newMessage
        })
      });
    } catch (e) {
      console.error("Erro ao enviar", e);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedChat) return;
    try {
      await fetch(`/api/whatsapp/chats/${selectedChat.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setSelectedChat({ ...selectedChat, chat_status: status });
    } catch (e) {
      console.error("Erro ao atualizar status", e);
    }
  };

  const filteredChats = chats.filter(chat => {
    if (filter === "ALL") return true;
    return chat.chat_status === filter;
  });

  const handleConnect = async () => {
    setIsLoadingQr(true);
    try {
      const response = await fetch('/api/whatsapp/instance', { method: 'POST' });
      const data = await response.json();
      if (data.qrcode) {
        setQrCode(data.qrcode);
      } else if (data.connected) {
        setIsConnected(true);
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoadingQr(false);
  };

  if (isCheckingConnection) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <RefreshCcw className="w-8 h-8 animate-spin" />
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
          <h2 className="text-xl font-bold text-foreground mb-2">Conectar WhatsApp</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Escaneie o QR Code para conectar o seu chip de prospecção.
          </p>
          
          {isLoadingQr ? (
            <div className="w-56 h-56 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground bg-slate-50">
              <RefreshCcw className="w-6 h-6 animate-spin" />
            </div>
          ) : qrCode ? (
            <div className="p-4 bg-white border border-border rounded-lg shadow-sm">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
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

  return (
    <div className="h-[calc(100vh-130px)] flex bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Sidebar - Lista de Chats */}
      <div className="w-80 border-r border-border flex flex-col bg-slate-50">
        <div className="p-4 border-b border-border bg-white flex items-center justify-between">
          <h2 className="font-semibold text-lg text-foreground">Conversas</h2>
          <div className="w-2 h-2 rounded-full bg-green-500" title="WhatsApp Conectado"></div>
        </div>
        
        <div className="p-3 border-b border-border bg-white flex flex-col gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
            {['ALL', 'UNANSWERED', 'ANSWERED', 'INTERESTED', 'CLOSED'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f === 'ALL' ? 'Todos' : 
                 f === 'UNANSWERED' ? 'Não Resp.' : 
                 f === 'ANSWERED' ? 'Respondido' : 
                 f === 'INTERESTED' ? 'Interessado' : 'Fechado'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.map(chat => (
            <button 
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`w-full text-left p-3 border-b border-border hover:bg-slate-100 flex gap-3 transition-colors ${selectedChat?.id === chat.id ? 'bg-slate-100' : 'bg-white'}`}
            >
              <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0 flex items-center justify-center text-slate-500 font-medium overflow-hidden">
                {chat.name?.substring(0, 2).toUpperCase() || "??"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-medium text-sm text-foreground truncate">{chat.name}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(chat.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground truncate pr-2">
                    {chat.last_message_preview || "..."}
                  </p>
                  {chat.unread_count > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
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

      {/* Main Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-[#efeae2]">
          {/* Header */}
          <div className="px-4 py-3 bg-white border-b border-border flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-medium">
                {selectedChat.name?.substring(0, 2).toUpperCase() || "??"}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{selectedChat.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedChat.phone}</p>
              </div>
            </div>
            
            <div>
              <select 
                value={selectedChat.chat_status || 'UNANSWERED'}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="text-xs font-medium bg-slate-100 border-none rounded-md px-2 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-green-500"
              >
                <option value="UNANSWERED">Não Respondido</option>
                <option value="ANSWERED">Respondido</option>
                <option value="INTERESTED">Interessado</option>
                <option value="CLOSED">Fechado</option>
              </select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {messages.map(msg => {
              const isMe = msg.from_me;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm text-sm ${isMe ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                    {msg.content.startsWith('[AUDIO] ') ? (
                      <audio src={msg.content.substring(8)} controls className="max-w-[240px] h-10" />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-[10px] text-slate-500">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      {isMe && (
                        <span className={`text-[12px] flex items-center ${msg.status === 'READ' ? 'text-blue-500' : 'text-slate-400'}`}>
                          {msg.status === 'PENDING' ? '⏳' : msg.status === 'SENT' ? <Check className="w-3 h-3"/> : <CheckCheck className="w-3 h-3"/>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-3 bg-slate-100 flex items-end gap-2">
            <textarea 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite uma mensagem"
              className="flex-1 resize-none max-h-32 min-h-[44px] p-3 rounded-lg border-none focus:ring-0 outline-none shadow-sm text-sm"
              rows={1}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors shadow-sm"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <QrCode className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-light text-slate-600 mb-2">WhatsApp Conectado</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Selecione uma conversa ao lado para começar a conversar com seus leads.
          </p>
        </div>
      )}
    </div>
  );
}
