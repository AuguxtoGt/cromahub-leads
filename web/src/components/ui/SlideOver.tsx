"use client";

import { useState } from "react";
import { X, Mail, Phone, MapPin, Globe, Link as LinkIcon, Send } from "lucide-react";

// Ícone Instagram (SVG próprio pois lucide-react não tem)
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}


interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  lead: any;
}

// Ícone do WhatsApp (SVG)
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export function SlideOver({ isOpen, onClose, lead }: SlideOverProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen || !lead) return null;

  const copyToClipboard = (text: string, label: string) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Formata o número para link do WhatsApp (remove espaços e +)
  const getWhatsAppLink = () => {
    if (!lead.phone) return null;
    const clean = lead.phone.replace(/[^\d]/g, "");
    return `https://wa.me/${clean}`;
  };

  // Gera o link do Google Maps
  const getMapsLink = () => {
    if (lead.place_id) return `https://www.google.com/maps/place/?q=place_id:${lead.place_id}`;
    if (lead.formatted_address) return `https://www.google.com/maps/search/${encodeURIComponent(lead.formatted_address)}`;
    return null;
  };

  // Detecta tipo de link para as Redes
  const getNetworkLinks = () => {
    const links: { type: string, url: string, label: string }[] = [];
    if (!lead.website) return links;
    const url = lead.website.toLowerCase();

    if (url.includes("instagram.com")) {
      links.push({ type: "instagram", url: lead.website, label: "Instagram" });
    } else if (url.includes("facebook.com")) {
      links.push({ type: "facebook", url: lead.website, label: "Facebook" });
    } else if (!url.includes("wa.me") && !url.includes("whatsapp")) {
      links.push({ type: "site", url: lead.website, label: "Site" });
    }

    return links;
  };

  const networkLinks = getNetworkLinks();
  const mapsLink = getMapsLink();
  const waLink = getWhatsAppLink();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Perfil do Lead</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Copied toast */}
        {copied && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-50 animate-fade-in">
            ✓ {copied} copiado!
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">

          {/* Profile Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white shadow-sm flex items-center justify-center text-2xl font-bold text-slate-500">
              {lead?.name?.charAt(0) || "L"}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground">{lead?.name || "Nome do Lead"}</h3>
              <p className="text-muted-foreground text-sm">{lead?.formatted_address || "Endereço não informado"}</p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 mt-2">
              {/* Telefone — copia */}
              <button
                onClick={() => copyToClipboard(lead?.phone, "Telefone")}
                title={lead?.phone ? `Copiar: ${lead.phone}` : "Sem telefone"}
                className={`w-10 h-10 rounded-full border border-border flex items-center justify-center transition-colors text-muted-foreground ${lead?.phone ? "hover:bg-muted hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
              >
                <Phone className="w-4 h-4" />
              </button>

              {/* E-mail — copia */}
              <button
                onClick={() => copyToClipboard(lead?.email, "E-mail")}
                title={lead?.email ? `Copiar: ${lead.email}` : "Sem e-mail"}
                className={`w-10 h-10 rounded-full border border-border flex items-center justify-center transition-colors text-muted-foreground ${lead?.email ? "hover:bg-muted hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
              >
                <Mail className="w-4 h-4" />
              </button>

              {/* Google Maps — copia link */}
              <button
                onClick={() => copyToClipboard(mapsLink || "", "Link do Maps")}
                title={mapsLink ? "Copiar link do Google Maps" : "Sem localização"}
                className={`w-10 h-10 rounded-full border border-border flex items-center justify-center transition-colors text-muted-foreground ${mapsLink ? "hover:bg-muted hover:text-foreground cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
              >
                <MapPin className="w-4 h-4" />
              </button>

              {/* WhatsApp — abre conversa */}
              <a
                href={waLink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                title={waLink ? `Abrir WhatsApp: ${lead.phone}` : "Sem telefone"}
                onClick={(e) => !waLink && e.preventDefault()}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${waLink ? "bg-green-500 hover:bg-green-600 text-white shadow-sm cursor-pointer" : "bg-slate-100 text-slate-300 cursor-not-allowed"}`}
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Informações Básicas */}
          <div className="flex flex-col gap-4">
            <div className="border-b border-border pb-2">
              <h4 className="font-semibold text-foreground">Informações Básicas</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Nome</span>
                <span className="font-medium">{lead?.name || "–"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Avaliação Google</span>
                <span className="font-medium">{lead?.rating ? `⭐ ${lead.rating} (${lead.user_ratings_total} avaliações)` : "–"}</span>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Endereço</span>
                <span className="font-medium">{lead?.formatted_address || "–"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Status</span>
                <span className="font-medium px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs w-fit border border-blue-100">Capturado</span>
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="flex flex-col gap-4">
            <div className="border-b border-border pb-2">
              <h4 className="font-semibold text-foreground">Contato</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Telefone</span>
                <button
                  onClick={() => copyToClipboard(lead?.phone, "Telefone")}
                  className="font-medium text-left hover:text-primary transition-colors cursor-pointer"
                >
                  {lead?.phone || "–"}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">E-mail</span>
                <button
                  onClick={() => copyToClipboard(lead?.email, "E-mail")}
                  className="font-medium text-left hover:text-primary transition-colors cursor-pointer"
                >
                  {lead?.email || "–"}
                </button>
              </div>
            </div>
          </div>

          {/* Redes */}
          <div className="flex flex-col gap-4">
            <div className="border-b border-border pb-2">
              <h4 className="font-semibold text-foreground">Redes</h4>
            </div>

            {networkLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma rede ou site encontrado.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {networkLinks.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted hover:border-primary/30 transition-all text-sm font-medium text-foreground group"
                    title={`Abrir ${link.label}`}
                  >
                    {link.type === "instagram" && (
                      <InstagramIcon className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform" />
                    )}
                    {link.type === "facebook" && (
                      <Globe className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    )}
                    {link.type === "site" && (
                      <Globe className="w-4 h-4 text-slate-500 group-hover:scale-110 transition-transform" />
                    )}
                    <span className="truncate max-w-[180px]">{link.label}</span>
                    <LinkIcon className="w-3 h-3 text-muted-foreground ml-auto" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Mensagem da IA */}
          {lead?.ai_message && (
            <div className="flex flex-col gap-4">
              <div className="border-b border-border pb-2">
                <h4 className="font-semibold text-foreground">✨ Mensagem IA (1º Contato)</h4>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {lead.ai_message}
              </div>
              <button
                onClick={() => copyToClipboard(lead.ai_message, "Mensagem da IA")}
                className="text-xs text-primary hover:underline text-left"
              >
                📋 Copiar mensagem
              </button>
            </div>
          )}

          {/* Follow-up IA */}
          {lead?.ai_follow_up && (
            <div className="flex flex-col gap-4">
              <div className="border-b border-border pb-2">
                <h4 className="font-semibold text-foreground">✨ Follow-up (Dia Seguinte)</h4>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {lead.ai_follow_up}
              </div>
              <button
                onClick={() => copyToClipboard(lead.ai_follow_up, "Follow-up da IA")}
                className="text-xs text-primary hover:underline text-left"
              >
                📋 Copiar follow-up
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/30 flex gap-3">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Abrir WhatsApp
            </a>
          )}
          <button className="flex-1 px-4 py-2 bg-primary text-white font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />
            Disparar IA
          </button>
        </div>
      </div>
    </>
  );
}
