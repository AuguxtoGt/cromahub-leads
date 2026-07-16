import Link from 'next/link';
import { 
  Search, 
  Users, 
  MessageCircle, 
  Briefcase,
  Settings,
  HelpCircle,
  LayoutDashboard,
  Sparkles
} from 'lucide-react';

import { WhatsAppStatusIndicator } from '@/components/WhatsAppStatusIndicator';

const MENU_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/', icon: Users },
  { name: 'Extração', href: '/extract', icon: Search },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { name: 'Clientes', href: '/clients', icon: Briefcase },
  { name: 'Instruções IA', href: '/instrucoes', icon: Sparkles },
];

const BOTTOM_ITEMS = [
  { name: 'Configurações', href: '/settings', icon: Settings },
  { name: 'Ajuda', href: '/help', icon: HelpCircle },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-sidebar border-r border-border h-screen flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="h-20 flex flex-col justify-center px-6 border-b border-border gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">CH</span>
          </div>
          <span className="font-semibold text-lg">CromaHUB</span>
        </div>
        <WhatsAppStatusIndicator />
      </div>

      {/* Main Menu */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-1">
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">
          Menu Principal
        </div>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Menu */}
      <div className="p-4 border-t border-border flex flex-col gap-1">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
