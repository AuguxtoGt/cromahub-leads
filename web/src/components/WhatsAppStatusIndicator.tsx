"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Wifi, WifiOff } from "lucide-react";

export function WhatsAppStatusIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let statusSub: any = null;

    const checkStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('settings')
        .select('whatsapp_status')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setIsConnected(data.whatsapp_status === 'open');
      }

      statusSub = supabase
        .channel("sidebar-whatsapp-status")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "settings", filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.new.whatsapp_status) {
              setIsConnected(payload.new.whatsapp_status === 'open');
            }
          }
        )
        .subscribe();
    };

    checkStatus();

    return () => {
      if (statusSub) {
        supabase.removeChannel(statusSub);
      }
    };
  }, []);

  if (isConnected === null) return null;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold tracking-wide border ${
      isConnected 
        ? "bg-green-50 text-green-700 border-green-200" 
        : "bg-red-50 text-red-700 border-red-200"
    }`}>
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
      </span>
      {isConnected ? 'WA Online' : 'WA Offline'}
    </div>
  );
}
