import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog, UserPlus, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Func { id: string; nome: string; email: string; papel: string; permissoes: string[] }

const PERMISSOES: { key: string; label: string }[] = [
  { key: "VER_TRANSPORTE", label: "Ver viagem ao vivo / enquete" },
  { key: "INSERIR_FILA", label: "Inserir aluno na fila" },
  { key: "VER_EMBARQUE", label: "Ver embarque (contagem)" },
  { key: "ESCANEAR_EMBARQUE", label: "Escanear embarque (monitor)" },
  { key: "APROVAR_DOCUMENTOS", label: "Aprovar autorizações/documentos" },
  { key: "GERIR_ALUNOS", label: "Gerir alunos" },
  { key: "GERIR_ROTAS", label: "Gerir rotas" },
  { key: "GERIR_FROTA", label: "Gerir frota" },
  { key: "GERIR_TEMPLATE", label: "Editar carteirinha" },
  { key: "GERIR_CALENDARIO", label: "Gerir calendário" },
  { key: "VER_AUDITORIA", label: "Ver auditoria" },
  { key: "GERIR_FUNCIONARIOS", label: "Gerir funcionários" },
];

export default function Funcionarios() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);

  const { data: funcs, isLoading } = useQuery({
    queryKey: ["painel-funcionarios"],
    queryFn: async () => {
      const { data } = await supabase.from("Usuario").select("id,nome,email,papel,permissoes").in("papel", ["ADMIN", "FISCAL"]).order("nome");
      return (data as Func[]) ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Funcionários</h1>
        </div>
        <button onClick={() => setNovo((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900">
          <UserPlus className="h-4 w-4" /> Cadastrar funcionário
        </button>
      </div>
      <p className="text-sm text-slate-500">Cadastre responsáveis e defina exatamente o que cada um acessa no sistema.</p>

      {novo && <NovoFuncionario secretariaId={perfil?.secretariaId ?? null} aoConcluir={() => { setNovo(false); qc.invalidateQueries({ queryKey: ["painel-funcionarios"] }); }} />}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {(funcs ?? []).map((f) => (
            <div key={f.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">{f.nome}</p>
                  <p className="text-xs text-slate-400">{f.email}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">{f.papel}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {(!f.permissoes || f.permissoes.length === 0)
                  ? (f.papel === "ADMIN" ? "Acesso total (admin da secretaria)" : "Sem permissões definidas")
                  : `${f.permissoes.length} permissão(ões): ` + f.permissoes.map((p) => PERMISSOES.find((x) => x.key === p)?.label ?? p).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NovoFuncionario({ secretariaId, aoConcluir }: { secretariaId: string | null; aoConcluir: () => void }) {
  const [papel, setPapel] = useState("FISCAL");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string; link?: string } | null>(null);

  function toggle(k: string) {
    setPerms((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.functions.invoke("provisionar-funcionario", {
      body: { nome: f.get("nome"), email: f.get("email"), papel, permissoes: [...perms], secretariaId },
    });
    setEnviando(false);
    if (error || !data?.ok) {
      let texto = "Não foi possível cadastrar.";
      const ctx = (error as { context?: Response })?.context;
      try { if (ctx) texto = (await ctx.json()).error ?? texto; } catch { /* */ }
      setMsg({ tom: "erro", texto });
      return;
    }
    if (data.emailEnviado) setMsg({ tom: "ok", texto: "Funcionário cadastrado e convite enviado." });
    else setMsg({ tom: "ok", texto: "Funcionário cadastrado. Envie este link de ativação:", link: data.actionLink });
    (e.target as HTMLFormElement).reset();
    setPerms(new Set());
    setTimeout(aoConcluir, data.emailEnviado ? 1200 : 7000);
  }

  const cls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      {msg && (
        <div className={`rounded-md px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <p className="flex items-center gap-1">{msg.tom === "ok" && <Check className="h-4 w-4" />}{msg.texto}</p>
          {msg.link && <p className="mt-1 break-all text-xs text-slate-600">{msg.link}</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium text-slate-700">Nome *</span><input name="nome" required className={cls + " w-full"} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">E-mail *</span><input name="email" type="email" required className={cls + " w-full"} /></label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Tipo</span>
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className={cls + " w-full"}>
            <option value="FISCAL">Funcionário / Monitor</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Permissões (o que ele acessa)</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {PERMISSOES.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={perms.has(p.key)} onChange={() => toggle(p.key)} />
              {p.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">Administrador sem nenhuma permissão marcada = acesso total à secretaria.</p>
      </div>
      <button type="submit" disabled={enviando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
        {enviando ? "Cadastrando…" : "Cadastrar e convidar"}
      </button>
    </form>
  );
}
