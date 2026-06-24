"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { login, forgotPassword } from "./actions";
import { Mail, Lock, Loader2, ArrowLeft } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const type = searchParams.get("type"); // "success" | undefined (default = error)

  const [showForgot, setShowForgot] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">

        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">CH</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">CromaHUB Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            {showForgot ? "Recuperação de senha" : "Área Restrita"}
          </p>
        </div>

        {/* Mensagem de feedback */}
        {message && (
          <div
            className={`mb-5 text-sm rounded-lg px-4 py-3 border ${
              type === "success"
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            {type === "success" ? "✅ " : "⚠️ "}
            {decodeURIComponent(message)}
          </div>
        )}

        {/* ── TELA: Esqueci minha senha ── */}
        {showForgot ? (
          <form
            className="space-y-4"
            onSubmit={() => setIsLoading(true)}
          >
            <p className="text-sm text-gray-600">
              Informe seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="forgot-email">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <button
              formAction={forgotPassword}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Enviar link de recuperação
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao login
            </button>
          </form>
        ) : (
          /* ── TELA: Login ── */
          <form className="space-y-4" onSubmit={() => setIsLoading(true)}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              formAction={login}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}
