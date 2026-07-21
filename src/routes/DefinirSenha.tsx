import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function DefinirSenha() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false); // sessão do convite detectada
  const [semSessao, setSemSessao] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // O link do convite redireciona para cá com os tokens no hash; o supabase-js
  // detecta e cria a sessão automaticamente. Aguardamos ela aparecer.
  useEffect(() => {
    let ok = false;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        ok = true;
        setPronto(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        ok = true;
        setPronto(true);
      }
    });
    const t = setTimeout(() => {
      if (!ok) setSemSessao(true);
    }, 3000);
    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter ao menos 6 caracteres.");
    if (senha !== confirma) return setErro("As senhas não conferem.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar a senha. O link pode ter expirado.");
    // vai para o portal — verá o aviso para enviar a documentação, se ainda não autorizado
    navigate("/portal", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/sysbus-logo.png" alt="SYSBUS" className="h-10 w-auto object-contain rounded-xl" />
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Ativar acesso</p>
            <p className="text-xs text-slate-500">Transporte universitário</p>
          </div>
        </div>

        {semSessao ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              Link inválido ou expirado. Peça à secretaria para reenviar o convite.
            </p>
          </div>
        ) : !pronto ? (
          <p className="py-10 text-center text-sm text-slate-400">Validando seu convite…</p>
        ) : (
          <form
            onSubmit={salvar}
            className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium">Defina sua senha de acesso</p>
            </div>
            {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Nova senha</span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Confirmar senha</span>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-brand-800 py-2.5 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {salvando ? "Salvando…" : "Ativar acesso"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
