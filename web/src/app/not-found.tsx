import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center">
      <div className="bg-amber-50 p-6 rounded-full border border-amber-100">
        <AlertTriangle className="w-16 h-16 text-amber-500" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404 - Página não encontrada</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Ops! Parece que o lead ou a página que você está procurando não existe mais ou foi movido.
        </p>
      </div>

      <Link 
        href="/"
        className="flex items-center gap-2 mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para o Dashboard
      </Link>
    </div>
  );
}
