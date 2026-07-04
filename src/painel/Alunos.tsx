import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus, Search, Check, Printer, X, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { montarCarteirinha, type AlunoParaCartao } from "../lib/carteirinha-render";
import { formatarValidade } from "../lib/carteirinha";
import CarteirinhaImpressao from "../components/CarteirinhaImpressao";

const um = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

interface AlunoRow {
  id: string; nome: string; cpf: string; curso: string | null; faculdade: string | null;
  matricula: string | null; destinoId: string | null; status: string;
  destino: unknown; carteirinha: unknown;
}
interface Destino { id: string; nome: string }

function autorizado(cart: unknown): boolean {
  const c = um(cart) as { validade: string | null } | null;
  const v = c?.validade ? new Date(c.validade).getTime() : null;
  return v !== null && v >= Date.now();
}

export default function Alunos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [sel, setSel] = useState<AlunoRow | null>(null);

  const { data: alunos, isLoading } = useQuery({
    queryKey: ["painel-alunos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("Aluno")
        .select("id, nome, cpf, curso, faculdade, matricula, destinoId, status, destino:Destino ( nome ), carteirinha:Carteirinha ( validade )")
        .order("nome");
      return (data as AlunoRow[]) ?? [];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return alunos ?? [];
    return (alunos ?? []).filter((a) => a.nome.toLowerCase().includes(q) || a.cpf.includes(q));
  }, [alunos, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Alunos</h1>
        </div>
        <button
          onClick={() => setNovo((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          <UserPlus className="h-4 w-4" /> Cadastrar aluno
        </button>
      </div>

      {novo && <NovoAluno aoConcluir={() => { setNovo(false); qc.invalidateQueries({ queryKey: ["painel-alunos"] }); }} />}

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou CPF"
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">
          Nenhum aluno encontrado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">CPF</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Rota</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map((a) => {
                const dest = um(a.destino) as { nome: string } | null;
                const ok = autorizado(a.carteirinha);
                const desligado = a.status === "DESLIGADO";
                return (
                  <tr key={a.id} onClick={() => setSel(a)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className={`font-medium ${desligado ? "text-slate-400 line-through" : "text-slate-800"}`}>{a.nome}</p>
                      <p className="text-xs text-slate-400">{a.curso ?? "—"}</p>
                    </td>
                    <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{a.cpf}</td>
                    <td className="hidden px-4 py-2.5 text-slate-600 md:table-cell">{dest?.nome ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${desligado ? "bg-slate-100 text-slate-500 ring-slate-200" : ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}>
                        {desligado ? "Desligado" : ok ? "Autorizado" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <AlunoDetalhe
          aluno={sel}
          aoFechar={() => setSel(null)}
          aoMudar={() => { setSel(null); qc.invalidateQueries({ queryKey: ["painel-alunos"] }); }}
        />
      )}
    </div>
  );
}

const one = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

interface AlunoDados {
  id: string; nome: string; cpf: string; curso: string | null; faculdade: string | null;
  matricula: string | null; destinoId: string | null; dataNascimento: string | null;
  fotoUrl: string | null; status: string; usuario: { email: string } | null;
}

function AlunoDetalhe({ aluno, aoFechar, aoMudar }: { aluno: AlunoRow; aoFechar: () => void; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const { data: rotas } = useQuery({
    queryKey: ["rotas-para-cadastro"],
    queryFn: async () => {
      const { data } = await supabase.from("Destino").select("id,nome").order("nome");
      return (data as Destino[]) ?? [];
    },
  });

  const { data: dados } = useQuery({
    queryKey: ["aluno-full", aluno.id],
    queryFn: async (): Promise<AlunoDados | null> => {
      const { data } = await supabase.from("Aluno")
        .select("id,nome,cpf,curso,faculdade,matricula,destinoId,dataNascimento,fotoUrl,status,usuario:Usuario(email)")
        .eq("id", aluno.id).maybeSingle();
      if (!data) return null;
      const d = data as Record<string, unknown>;
      d.usuario = one(d.usuario);
      return d as unknown as AlunoDados;
    },
  });

  const { data: cartData } = useQuery({
    queryKey: ["aluno-cartao", aluno.id],
    queryFn: async (): Promise<AlunoParaCartao | null> => {
      const { data } = await supabase.from("Aluno").select(
        `nome, matricula, curso, fotoUrl, faculdade,
         destino:Destino ( modelo:ModeloCarteirinha ( campos, largura, altura, arteFrenteUrl, arteVersoUrl ) ),
         carteirinha:Carteirinha ( qrToken, validade )`,
      ).eq("id", aluno.id).maybeSingle();
      if (!data) return null;
      const d = data as Record<string, unknown>;
      d.destino = one(d.destino);
      if (d.destino) (d.destino as Record<string, unknown>).modelo = one((d.destino as Record<string, unknown>).modelo);
      d.carteirinha = one(d.carteirinha);
      return d as unknown as AlunoParaCartao;
    },
  });
  const cartao = cartData ? montarCarteirinha(cartData) : null;
  const desligado = (dados?.status ?? aluno.status) === "DESLIGADO";
  const validadeMs = cartao?.dados.validade ? new Date(cartao.dados.validade).getTime() : null;
  const jaAutorizado = validadeMs !== null && validadeMs >= Date.now();

  async function acao(action: string, body: Record<string, unknown> = {}) {
    setOcupado(true);
    await supabase.functions.invoke("gerir-aluno", { body: { action, alunoId: aluno.id, ...body } });
    setOcupado(false);
    aoMudar();
  }
  async function autorizar() {
    if (window.confirm("Autorizar a carteirinha deste aluno para o período letivo vigente?")) acao("autorizar");
  }
  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await acao("editar", {
      nome: f.get("nome"), curso: f.get("curso"), faculdade: f.get("faculdade"),
      matricula: f.get("matricula"), destinoId: f.get("destinoId"), dataNascimento: f.get("dataNascimento"),
    });
  }
  async function desligar() {
    if (window.confirm("Desligar este aluno? O acesso dele será revogado (reversível).")) acao("desligar");
  }
  async function anonimizar() {
    if (window.prompt("ANONIMIZAR é IRREVERSÍVEL (LGPD — apaga nome, CPF, e-mail, foto e documentos). Digite ANONIMIZAR para confirmar:") === "ANONIMIZAR") acao("anonimizar");
  }

  const cls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
  const iniciais = aluno.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={aoFechar}>
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {/* header institucional */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {dados?.fotoUrl ? <img src={dados.fotoUrl} alt="" className="h-full w-full object-cover" /> : iniciais}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{aluno.nome}</p>
            <p className="truncate text-xs text-slate-500">CPF {dados?.cpf ?? aluno.cpf}{dados?.usuario?.email ? ` · ${dados.usuario.email}` : ""}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${desligado ? "bg-slate-100 text-slate-500 ring-slate-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200"}`}>
            {desligado ? "Desligado" : "Ativo"}
          </span>
          <button onClick={aoFechar} className="shrink-0 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-5">
          {!dados ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando dados…</p>
          ) : (
            <form onSubmit={salvar} className="space-y-3">
              <label className="block text-sm"><span className="font-medium text-slate-700">Nome completo</span><input name="nome" defaultValue={dados.nome} required className={cls} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm"><span className="font-medium text-slate-700">Curso</span><input name="curso" defaultValue={dados.curso ?? ""} className={cls} /></label>
                <label className="block text-sm"><span className="font-medium text-slate-700">Matrícula</span><input name="matricula" defaultValue={dados.matricula ?? ""} className={cls} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm"><span className="font-medium text-slate-700">Faculdade</span><input name="faculdade" defaultValue={dados.faculdade ?? ""} className={cls} /></label>
                <label className="block text-sm"><span className="font-medium text-slate-700">Nascimento</span><input name="dataNascimento" type="date" defaultValue={dados.dataNascimento ? dados.dataNascimento.slice(0, 10) : ""} className={cls} /></label>
              </div>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Cidade / rota</span>
                <select name="destinoId" defaultValue={dados.destinoId ?? ""} className={cls}>
                  <option value="">Selecione…</option>
                  {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </label>
              <button type="submit" disabled={ocupado} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
                {ocupado ? "Salvando…" : "Salvar alterações"}
              </button>
            </form>
          )}

          {/* Autorização da carteirinha */}
          {dados && !desligado && (
            <div className="mt-4">
              {jaAutorizado ? (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <ShieldCheck className="h-4 w-4" /> Autorizada até {formatarValidade(cartao?.dados.validade ?? null)}
                  </p>
                  <button onClick={autorizar} disabled={ocupado} className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-60">Renovar</button>
                </div>
              ) : (
                <button onClick={autorizar} disabled={ocupado} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  <ShieldCheck className="h-4 w-4" /> {ocupado ? "Autorizando…" : "Autorizar carteirinha (liberar período)"}
                </button>
              )}
            </div>
          )}

          {cartao && jaAutorizado && (
            <button onClick={() => window.print()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Printer className="h-4 w-4" /> Imprimir carteirinha (frente e verso)
            </button>
          )}
          {cartao && jaAutorizado && (
            <CarteirinhaImpressao campos={cartao.campos} dados={cartao.dados} arteUrl={cartao.arteUrl} arteVersoUrl={cartao.arteVersoUrl} larguraBase={cartao.larguraBase} alturaBase={cartao.alturaBase} />
          )}

          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ações</p>
            {desligado ? (
              <button onClick={() => acao("reativar")} disabled={ocupado} className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50">Reativar aluno</button>
            ) : (
              <button onClick={desligar} disabled={ocupado} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Desligar (revogar acesso)</button>
            )}
            <button onClick={anonimizar} disabled={ocupado} className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Anonimizar (LGPD — irreversível)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NovoAluno({ aoConcluir }: { aoConcluir: () => void }) {
  const [destinos] = useState<Destino[]>([]);
  const { data: rotas } = useQuery({
    queryKey: ["rotas-para-cadastro"],
    queryFn: async () => {
      const { data } = await supabase.from("Destino").select("id,nome").order("nome");
      return (data as Destino[]) ?? [];
    },
    initialData: destinos,
  });
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string; link?: string } | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const body = {
      nome: f.get("nome"), email: f.get("email"), cpf: f.get("cpf"),
      destinoId: f.get("destinoId"), curso: f.get("curso"), faculdade: f.get("faculdade"), matricula: f.get("matricula"),
    };
    const { data, error } = await supabase.functions.invoke("provisionar-aluno", { body });
    setEnviando(false);
    if (error || !data?.ok) {
      let texto = "Não foi possível cadastrar.";
      const ctx = (error as { context?: Response })?.context;
      try { if (ctx) texto = (await ctx.json()).error ?? texto; } catch { /* */ }
      setMsg({ tom: "erro", texto });
      return;
    }
    if (data.emailEnviado) {
      setMsg({ tom: "ok", texto: "Convite enviado por e-mail ao aluno." });
    } else {
      setMsg({ tom: "ok", texto: "Aluno cadastrado. Envie este link de ativação a ele:", link: data.actionLink });
    }
    (e.target as HTMLFormElement).reset();
    setTimeout(aoConcluir, data.emailEnviado ? 1200 : 6000);
  }

  const inputCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-800">Cadastrar novo aluno</p>
      {msg && (
        <div className={`rounded-md px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <p className="flex items-center gap-1">{msg.tom === "ok" && <Check className="h-4 w-4" />}{msg.texto}</p>
          {msg.link && <p className="mt-1 break-all text-xs text-slate-600">{msg.link}</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm"><span className="font-medium text-slate-700">Nome *</span><input name="nome" required className={inputCls} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">CPF *</span><input name="cpf" required className={inputCls} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">E-mail *</span><input name="email" type="email" required className={inputCls} /></label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Rota *</span>
          <select name="destinoId" required defaultValue="" className={inputCls}>
            <option value="" disabled>Selecione…</option>
            {(rotas ?? []).map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </label>
        <label className="block text-sm"><span className="font-medium text-slate-700">Curso</span><input name="curso" className={inputCls} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">Matrícula</span><input name="matricula" className={inputCls} /></label>
      </div>
      <input name="faculdade" type="hidden" />
      <button type="submit" disabled={enviando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
        {enviando ? "Cadastrando…" : "Cadastrar e convidar"}
      </button>
    </form>
  );
}
