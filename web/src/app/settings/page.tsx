"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Save, Loader2, Trash2, Lock, Eye, EyeOff, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    offer_name: "",
    offer_price: "",
    offer_deadline: "",
    owner_name: "",
    owner_whatsapp: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*").single();
    if (data) {
      setSettings({
        offer_name: data.offer_name || "",
        offer_price: data.offer_price || "",
        offer_deadline: data.offer_deadline || "",
        owner_name: data.owner_name || "",
        owner_whatsapp: data.owner_whatsapp || "",
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const { data: existing } = await supabase.from("settings").select("id").single();
    const payload = {
      ...settings,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      const { error: updateError } = await supabase.from("settings").update(payload).eq("id", existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("settings").insert({
        id: crypto.randomUUID(),
        ...payload
      });
      error = insertError;
    }

    if (!error) {
      setSaved(true);
      toast.success("Configurações salvas!");
      setTimeout(() => setSaved(false), 3000);
    } else {
      console.error("Save error:", error);
      toast.error("Erro ao salvar: " + error.message);
    }
    setIsSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("ATENÇÃO: Você está prestes a excluir sua conta. Isso apagará permanentemente todos os seus leads, configurações e histórico de mensagens. Esta ação NÃO pode ser desfeita. Tem certeza absoluta que deseja continuar?")) {
      return;
    }
    
    setIsDeletingAccount(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const data = await res.json();
      
      if (res.ok) {
        toast.success("Conta excluída.");
        await supabase.auth.signOut();
        router.push("/login");
      } else {
        toast.error("Erro ao excluir conta: " + (data.error || "Desconhecido"));
      }
    } catch (err) {
      toast.error("Erro de conexão ao excluir conta.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus dados pessoais e de acesso</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-md font-medium text-sm hover:bg-red-100 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-md font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? "✓ Salvo!" : isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Oferta */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">💼 Sua Oferta</h2>
          <p className="text-sm text-muted-foreground mt-0.5">O que você vende. A IA menciona isso em todas as mensagens.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Produto</label>
            <input type="text" value={settings.offer_name}
              onChange={e => setSettings(s => ({ ...s, offer_name: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary bg-white"
              placeholder="Landing Page Profissional" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço (R$)</label>
            <div className="flex items-center border border-border rounded-md overflow-hidden focus-within:border-primary transition-all bg-white">
              <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-r border-border">R$</span>
              <input type="text" value={settings.offer_price}
                onChange={e => setSettings(s => ({ ...s, offer_price: e.target.value }))}
                className="flex-1 px-3 py-2 text-sm outline-none bg-white" placeholder="297" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prazo de Entrega</label>
            <input type="text" value={settings.offer_deadline}
              onChange={e => setSettings(s => ({ ...s, offer_deadline: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary bg-white"
              placeholder="24 horas" />
          </div>
        </div>
      </div>

      {/* Dados do dono */}
      <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
        <div className="border-b border-border pb-3">
          <h2 className="font-semibold text-foreground text-lg">👤 Seus Dados</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Identificação do vendedor e do WhatsApp disparador.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu Nome / Empresa</label>
            <input type="text" value={settings.owner_name}
              onChange={e => setSettings(s => ({ ...s, owner_name: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary bg-white"
              placeholder="Gustavo - CromaHUB" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Seu WhatsApp</label>
            <input type="text" value={settings.owner_whatsapp}
              onChange={e => setSettings(s => ({ ...s, owner_whatsapp: e.target.value }))}
              className="px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary bg-white"
              placeholder="+55 31 9 9999-9999" />
          </div>
        </div>
      </div>

      {/* Segurança */}
      <SecuritySection />
      
      {/* Danger Zone */}
      <DangerZone isDeletingAccount={isDeletingAccount} handleDeleteAccount={handleDeleteAccount} />
    </div>
  );
}

function SecuritySection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const passwordStrength = () => {
    if (newPassword.length === 0) return 0;
    let score = 0;
    if (newPassword.length >= 8) score++;
    if (/[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword)) score++;
    if (/[^A-Za-z0-9]/.test(newPassword)) score++;
    return score;
  };

  const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e"];
  const strength = passwordStrength();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setIsChanging(true);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error("Erro ao atualizar senha: " + error.message);
    } else {
      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      await supabase.auth.signOut({ scope: 'others' });
    }

    setIsChanging(false);
  };

  return (
    <div className="bg-sidebar border border-border rounded-xl p-6 shadow-sm flex flex-col gap-5">
      <div className="border-b border-border pb-3 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-blue-600" />
        <div>
          <h2 className="font-semibold text-foreground text-lg">🔒 Segurança</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Altere sua senha de acesso.</p>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 border border-border rounded-md text-sm outline-none focus:border-primary transition-all bg-white"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ backgroundColor: i <= strength ? strengthColor[strength] : "#e5e7eb" }}
                    />
                  ))}
                </div>
                <p className="text-xs" style={{ color: strengthColor[strength] }}>
                  {strengthLabel[strength]}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirmar Nova Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 border border-border rounded-md text-sm outline-none focus:border-primary transition-all bg-white"
                placeholder="Repita a nova senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-xs ${newPassword === confirmPassword ? "text-green-600" : "text-red-500"}`}>
                {newPassword === confirmPassword ? "✓ Senhas coincidem" : "✗ Senhas não coincidem"}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={isChanging || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
          >
            {isChanging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isChanging ? "Salvando..." : "Alterar Senha"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DangerZone({ isDeletingAccount, handleDeleteAccount }: { isDeletingAccount: boolean, handleDeleteAccount: () => void }) {
  return (
    <div className="bg-red-50/50 border border-red-200 rounded-xl p-6 shadow-sm flex flex-col gap-5 mt-8">
      <div className="border-b border-red-200 pb-3 flex items-center gap-2">
        <Trash2 className="w-5 h-5 text-red-600" />
        <div>
          <h2 className="font-semibold text-red-700 text-lg">Zona de Perigo</h2>
          <p className="text-sm text-red-600/80 mt-0.5">Ações destrutivas para sua conta.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 p-4 rounded-lg border border-red-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Excluir Conta</h3>
          <p className="text-xs text-gray-500 mt-1">
            Apaga permanentemente sua conta, leads, histórico de mensagens e configurações. Esta ação não pode ser desfeita.
          </p>
        </div>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-60 shadow-sm"
        >
          {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          {isDeletingAccount ? "Excluindo..." : "Excluir Conta"}
        </button>
      </div>
    </div>
  );
}
