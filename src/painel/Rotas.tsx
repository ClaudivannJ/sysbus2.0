import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Rota {
  id: string; nome: string; horarioSaida: string;
  enqueteAbre: string | null; enqueteFecha: string | null;
  intervaloChamadaS: number; diasSemana: number[];
}

const DIAS = [
  { n: 1, l: "Seg" }, { n: 2, l: "Ter" }, { n: 3, l: "Qua" }, { n: 4, l: "Qui" },
  { n: 5, l: "Sex" }, { n: 6, l: "Sáb" }, { n: 7, l: "Dom" },
];

export default function Rotas() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);

  const { data: rotas, isLoading } = useQuery({
    queryKey: ["painel-rotas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome,horarioSaida,enqueteAbre,enqueteFecha,intervaloChamadaS,diasSemana").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });

  async function criar(nome: string) {
    await supabase.from("Destino").insert({
      id: crypto.randomUUID(), nome, horarioSaida: "17:00", intervaloChamadaS: 10,
      diasSemana: [1, 2, 3, 4, 5], secretariaId: perfil?.secretariaId ?? null,
    });
    setCriando(false);
    qc.invalidateQueries({ queryKey: ["painel-rotas"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Rotas</h1>
        </div>
        <button onClick={() => setCriando((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900">
          <Plus className="h-4 w-4" /> Nova rota
        </button>
      </div>
      <p className="text-sm text-slate-500">Os horários da enquete e os dias de operação definem quando a viagem do dia é aberta para os alunos.</p>

      {criando && (
        <form
          onSubmit={(e) => { e.preventDefault(); const n = new FormData(e.currentTarget).get("nome") as string; if (n?.trim()) criar(n.trim()); }}
          className="flex gap-2 rounded-xl bg-white p-4 ring-1 ring-slate-200"
        >
          <input name="nome" placeholder="Nome da cidade/rota" required className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white">Criar</button>
        </form>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-3">
          {(rotas ?? []).map((r) => <RotaCard key={r.id} rota={r} />)}
        </div>
      )}
    </div>
  );
}

function RotaCard({ rota }: { rota: Rota }) {
  const qc = useQueryClient();
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dias, setDias] = useState<number[]>(rota.diasSemana ?? []);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    const f = new FormData(e.currentTarget);
    await supabase.from("Destino").update({
      horarioSaida: f.get("horarioSaida"),
      enqueteAbre: (f.get("enqueteAbre") as string) || null,
      enqueteFecha: (f.get("enqueteFecha") as string) || null,
      intervaloChamadaS: Number(f.get("intervaloChamadaS")) || 10,
      diasSemana: dias,
    }).eq("id", rota.id);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 1500);
    qc.invalidateQueries({ queryKey: ["painel-rotas"] });
  }

  const cls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500";
  return (
    <form onSubmit={salvar} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="font-semibold text-slate-800">{rota.nome}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block text-xs"><span className="font-medium text-slate-600">Saída</span><input name="horarioSaida" type="time" defaultValue={rota.horarioSaida} className={cls} /></label>
        <label className="block text-xs"><span className="font-medium text-slate-600">Enquete abre</span><input name="enqueteAbre" type="time" defaultValue={rota.enqueteAbre ?? ""} className={cls} /></label>
        <label className="block text-xs"><span className="font-medium text-slate-600">Enquete fecha</span><input name="enqueteFecha" type="time" defaultValue={rota.enqueteFecha ?? ""} className={cls} /></label>
        <label className="block text-xs"><span className="font-medium text-slate-600">Intervalo chamada (s)</span><input name="intervaloChamadaS" type="number" min={1} defaultValue={rota.intervaloChamadaS} className={cls} /></label>
      </div>
      <div>
        <span className="text-xs font-medium text-slate-600">Dias de operação</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DIAS.map((d) => {
            const on = dias.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                onClick={() => setDias((s) => (on ? s.filter((x) => x !== d.n) : [...s, d.n]))}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${on ? "bg-brand-800 text-white ring-slate-900" : "bg-white text-slate-500 ring-slate-300"}`}
              >
                {d.l}
              </button>
            );
          })}
        </div>
      </div>
      <button disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
        {salvo ? <><Check className="h-4 w-4" /> Salvo</> : salvando ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
