import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type Tipo = "FERIADO" | "FACULTATIVO" | "RECESSO" | "SEM_TRANSPORTE";
interface Excecao { id: string; data: string; tipo: Tipo; descricao: string | null; destinoId: string | null }
interface Rota { id: string; nome: string }

const LABEL: Record<Tipo, string> = { FERIADO: "Feriado", FACULTATIVO: "Facultativo", RECESSO: "Recesso", SEM_TRANSPORTE: "Sem transporte" };

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Calendario() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);

  const { data: excecoes, isLoading } = useQuery({
    queryKey: ["painel-calendario"],
    queryFn: async () => {
      const { data } = await supabase.from("ExcecaoCalendario").select("id,data,tipo,descricao,destinoId").order("data", { ascending: false });
      return (data as Excecao[]) ?? [];
    },
  });
  const { data: rotas } = useQuery({
    queryKey: ["rotas-simples", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["painel-calendario"] });

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const dia = f.get("data") as string;
    await supabase.from("ExcecaoCalendario").insert({
      id: crypto.randomUUID(),
      data: new Date(`${dia}T00:00:00Z`).toISOString(),
      tipo: f.get("tipo"),
      descricao: (f.get("descricao") as string) || null,
      destinoId: (f.get("destinoId") as string) || null,
      secretariaId: perfil?.secretariaId ?? null,
    });
    setCriando(false);
    invalidar();
  }
  async function apagar(id: string) {
    await supabase.from("ExcecaoCalendario").delete().eq("id", id);
    invalidar();
  }

  const cls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Calendário</h1>
        </div>
        <button onClick={() => setCriando((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900">
          <Plus className="h-4 w-4" /> Nova exceção
        </button>
      </div>
      <p className="text-sm text-slate-500">Feriados, facultativos e recessos suprimem a viagem/enquete do dia. Sem rota = vale para todas.</p>

      <PeriodoLetivo secretariaId={perfil?.secretariaId ?? null} />

      {criando && (
        <form onSubmit={criar} className="grid gap-2 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
          <input name="data" type="date" required className={cls} />
          <select name="tipo" required defaultValue="FERIADO" className={cls}>
            {(Object.keys(LABEL) as Tipo[]).map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
          <input name="descricao" placeholder="Descrição (opcional)" className={cls} />
          <select name="destinoId" defaultValue="" className={cls}>
            <option value="">Todas as rotas</option>
            {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white sm:col-span-2">Adicionar</button>
        </form>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (excecoes ?? []).length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Nenhuma exceção cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {(excecoes ?? []).map((x) => {
            const rota = rotas?.find((r) => r.id === x.destinoId);
            return (
              <div key={x.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="w-20 text-sm font-semibold text-slate-800">{dataBR(x.data)}</div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{LABEL[x.tipo]}</span>
                <div className="min-w-0 flex-1 text-sm text-slate-500">
                  {x.descricao ?? "—"} <span className="text-xs text-slate-400">· {rota ? rota.nome : "todas as rotas"}</span>
                </div>
                <button onClick={() => apagar(x.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Periodo { id?: string; label: string; validadeAte: string }

function PeriodoLetivo({ secretariaId }: { secretariaId: string | null }) {
  const qc = useQueryClient();
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { data: periodo } = useQuery({
    queryKey: ["periodo-letivo"],
    queryFn: async (): Promise<Periodo | null> => {
      const { data } = await supabase.from("PeriodoLetivo").select("id,label,validadeAte").maybeSingle();
      return (data as Periodo) ?? null;
    },
  });

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    const f = new FormData(e.currentTarget);
    const label = String(f.get("label") ?? "").trim();
    const dia = String(f.get("validadeAte") ?? "");
    const validadeAte = new Date(`${dia}T23:59:59-03:00`).toISOString();
    if (periodo?.id) {
      await supabase.from("PeriodoLetivo").update({ label, validadeAte, atualizadoEm: new Date().toISOString() }).eq("id", periodo.id);
    } else {
      await supabase.from("PeriodoLetivo").insert({ id: crypto.randomUUID(), secretariaId, label, validadeAte, atualizadoEm: new Date().toISOString() });
    }
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
    qc.invalidateQueries({ queryKey: ["periodo-letivo"] });
  }

  const cls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={salvar} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-800">Período letivo (validade das carteirinhas)</p>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        Define até quando a carteirinha aprovada NESTE período é válida (ex.: 2026.2 até 31/12/2026). Ao virar o semestre, atualize aqui — as carteirinhas do período anterior expiram e não valem no novo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Semestre / período</span>
          <input name="label" required defaultValue={periodo?.label ?? ""} placeholder="2026.2" className={cls} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Válida até</span>
          <input name="validadeAte" type="date" required defaultValue={periodo?.validadeAte ? periodo.validadeAte.slice(0, 10) : ""} className={cls} />
        </label>
      </div>
      <button disabled={salvando} className="mt-3 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
        {salvo ? "Salvo" : salvando ? "Salvando…" : "Salvar período"}
      </button>
    </form>
  );
}
