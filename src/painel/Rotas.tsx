import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route as RouteIcon, Plus, Check, MapPin, ArrowUp, ArrowDown, Trash2, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Rota {
  id: string; nome: string; horarioSaida: string;
  enqueteAbre: string | null; enqueteFecha: string | null;
  intervaloChamadaS: number; diasSemana: number[]; secretariaId: string | null;
  exibirQuemFalta: string;
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
      let q = supabase.from("Destino").select("id,nome,horarioSaida,enqueteAbre,enqueteFecha,intervaloChamadaS,diasSemana,secretariaId,exibirQuemFalta").order("nome");
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

      <Itinerario destinoId={rota.id} secretariaId={rota.secretariaId} exibirQuemFalta={rota.exibirQuemFalta} />
    </form>
  );
}

interface Ponto { id: string; sentido: "IDA" | "VOLTA"; ordem: number; nome: string; localidadeId: string | null; faculdade: string | null }
interface Localidade { id: string; nome: string }
const LABEL_EXIBIR: Record<string, string> = {
  QTD: "Só a quantidade que falta",
  NOME: "Só os nomes de quem falta",
  QTD_NOME: "Quantidade + nomes",
  PERFIL: "Quantidade + nomes + foto",
};

function Itinerario({ destinoId, secretariaId, exibirQuemFalta }: { destinoId: string; secretariaId: string | null; exibirQuemFalta: string }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [novaFac, setNovaFac] = useState("");
  const [novaLoc, setNovaLoc] = useState("");

  const { data: pontos } = useQuery({
    queryKey: ["pontos-rota", destinoId],
    enabled: aberto,
    queryFn: async () => {
      const { data } = await supabase.from("PontoRota").select("id,sentido,ordem,nome,localidadeId,faculdade").eq("destinoId", destinoId).order("ordem");
      return (data as Ponto[]) ?? [];
    },
  });
  const { data: locais } = useQuery({
    queryKey: ["localidades", secretariaId],
    enabled: aberto,
    queryFn: async () => {
      let q = supabase.from("Localidade").select("id,nome").order("nome");
      if (secretariaId) q = q.eq("secretariaId", secretariaId);
      const { data } = await q;
      return (data as Localidade[]) ?? [];
    },
  });

  const recarregar = () => qc.invalidateQueries({ queryKey: ["pontos-rota", destinoId] });
  const daFace = (s: "IDA" | "VOLTA") => (pontos ?? []).filter((p) => p.sentido === s).sort((a, b) => a.ordem - b.ordem);

  async function addIda() {
    if (!novaLoc) return;
    const loc = (locais ?? []).find((l) => l.id === novaLoc);
    const ordem = daFace("IDA").length;
    await supabase.from("PontoRota").insert({ id: crypto.randomUUID(), destinoId, sentido: "IDA", ordem, nome: loc?.nome ?? "Ponto", localidadeId: novaLoc });
    setNovaLoc("");
    recarregar();
  }
  async function addVolta() {
    const nome = novaFac.trim();
    if (!nome) return;
    const ordem = daFace("VOLTA").length;
    await supabase.from("PontoRota").insert({ id: crypto.randomUUID(), destinoId, sentido: "VOLTA", ordem, nome, faculdade: nome });
    setNovaFac("");
    recarregar();
  }
  async function remover(id: string) { await supabase.from("PontoRota").delete().eq("id", id); recarregar(); }
  async function mover(lista: Ponto[], i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const a = lista[i], b = lista[j];
    await supabase.from("PontoRota").update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("PontoRota").update({ ordem: a.ordem }).eq("id", b.id);
    recarregar();
  }
  async function mudarExibir(v: string) {
    await supabase.from("Destino").update({ exibirQuemFalta: v }).eq("id", destinoId);
    qc.invalidateQueries({ queryKey: ["painel-rotas"] });
  }

  function Lista({ sentido }: { sentido: "IDA" | "VOLTA" }) {
    const lista = daFace(sentido);
    return (
      <div className="space-y-1.5">
        {lista.length === 0 && <p className="text-xs text-slate-400">Nenhum ponto configurado.</p>}
        {lista.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">{i + 1}</span>
            <span className="flex-1 truncate text-sm text-slate-700">{p.nome}</span>
            <button type="button" onClick={() => mover(lista, i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" onClick={() => mover(lista, i, 1)} disabled={i === lista.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => remover(p.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    );
  }

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <MapPin className="h-4 w-4" /> Configurar itinerário e pontos
      </button>
    );
  }

  const inp = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="space-y-4 rounded-xl bg-slate-50/60 p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4 text-brand-600" /> Itinerário e pontos</p>
        <button type="button" onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-700"><ChevronDown className="h-4 w-4 rotate-180" /></button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Ida — pontos de embarque</p>
          <Lista sentido="IDA" />
          <div className="mt-2 flex gap-2">
            <select value={novaLoc} onChange={(e) => setNovaLoc(e.target.value)} className={`${inp} flex-1`}>
              <option value="">Escolher localidade…</option>
              {(locais ?? []).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <button type="button" onClick={addIda} disabled={!novaLoc} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">Adicionar</button>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Volta — pontos nas faculdades</p>
          <Lista sentido="VOLTA" />
          <div className="mt-2 flex gap-2">
            <input value={novaFac} onChange={(e) => setNovaFac(e.target.value)} placeholder="Nome da faculdade" className={`${inp} flex-1`} />
            <button type="button" onClick={addVolta} disabled={!novaFac.trim()} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50">Adicionar</button>
          </div>
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Exibir "quem falta" para os alunos</span>
        <select defaultValue={exibirQuemFalta} onChange={(e) => mudarExibir(e.target.value)} className={`${inp} mt-1 w-full`}>
          {Object.entries(LABEL_EXIBIR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
    </div>
  );
}
