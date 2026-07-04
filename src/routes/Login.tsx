import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bus } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const ident = login.trim();
      if (ident.includes("@")) {
        // e-mail → login nativo do Supabase
        const { error } = await supabase.auth.signInWithPassword({
          email: ident.toLowerCase(),
          password: senha,
        });
        if (error) throw error;
      } else {
        // CPF → Edge Function resolve o e-mail e devolve os tokens
        const { data, error } = await supabase.functions.invoke("login-aluno", {
          body: { login: ident, senha },
        });
        if (error || !data?.access_token) throw error ?? new Error("falha");
        const { error: sErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sErr) throw sErr;
      }
      navigate("/", { replace: true });
    } catch {
      setErro("CPF/e-mail ou senha inválidos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
            <Bus className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <p className="font-bold">SYSBUS</p>
            <p className="text-xs text-slate-400">Operação do Transporte Universitário</p>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug">
            Gestão do transporte universitário, em tempo real.
          </h2>
          <p className="mt-4 max-w-md text-slate-300">
            Carteirinha digital, autorização, reserva de vaga e chamada — sem a bagunça do
            WhatsApp.
          </p>
        </div>
        <p className="text-xs text-slate-500">Plataforma corporativa para secretarias.</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={entrar}
          className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200"
        >
          <div className="mb-2">
            <h1 className="text-xl font-bold text-slate-900">Acessar o sistema</h1>
            <p className="text-sm text-slate-500">Entre com suas credenciais.</p>
          </div>

          {erro && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}

          <label className="block text-sm">
            <span className="font-medium text-slate-700">CPF ou e-mail</span>
            <input
              type="text"
              inputMode="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              placeholder="000.000.000-00 ou voce@email.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand-800 py-2.5 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>

          <p className="text-center text-sm text-slate-500">
            É estudante e ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-medium text-brand-600 hover:underline">
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
