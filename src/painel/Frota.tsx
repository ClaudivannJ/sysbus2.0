import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus, Plus, Trash2, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

const um = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

interface Onibus {
  id: string; nome: string; placa: string | null; capacidade: number;
  motorista: string | null; ativo: boolean; destinoId?: string; destino: unknown;
  locais: { localidadeId: string; prioridade: number | null; localidade: unknown }[];
}
interface Rota { id: string; nome: string }
interface Localidade { id: string; nome: string; secretariaId: string | null }

function OnibusCard({ 
  o, salvarCap, toggleAtivo, apagar, localidades 
}: { 
  o: Onibus; salvarCap: (id: string, cap: number) => void; toggleAtivo: (o: Onibus) => void; apagar: (id: string) => void;
  localidades: Localidade[];
}) {
  const qc = useQueryClient();
  const [expandido, setExpandido] = useState(false);
  const dest = um(o.destino) as { nome: string } | null;

  const locaisAtuais = o.locais?.map(l => l.localidadeId) || [];

  async function toggleLocalidade(localidadeId: string, checked: boolean) {
    if (checked) {
      await supabase.from("OnibusLocalidade").insert({ onibusId: o.id, localidadeId });
    } else {
      await supabase.from("OnibusLocalidade").delete().eq("onibusId", o.id).eq("localidadeId", localidadeId);
    }
    qc.invalidateQueries({ queryKey: ["painel-frota"] });
  }

  return (
    <div className="flex flex-col rounded-xl bg-white ring-1 ring-slate-200 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-slate-800">{o.nome} {o.placa && <span className="text-xs text-slate-400">· {o.placa}</span>}</p>
          <p className="text-xs text-slate-400">{dest?.nome ?? "sem rota"}{o.motorista && ` · ${o.motorista}`}</p>
        </div>
        
        <button onClick={() => setExpandido(!expandido)} className="flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-1 rounded-md hover:bg-brand-100">
          <MapPin className="h-3 w-3" />
          {o.locais?.length || 0} locais
          {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <label className="flex items-center gap-1 text-xs text-slate-600">
          cap.
          <input type="number" min={1} defaultValue={o.capacidade} onBlur={(e) => { const v = Number(e.target.value); if (v && v !== o.capacidade) salvarCap(o.id, v); }} className="w-16 rounded border border-slate-300 px-2 py-1 text-sm" />
        </label>
        <button onClick={() => toggleAtivo(o)} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${o.ativo ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
          {o.ativo ? "ativo" : "inativo"}
        </button>
        <button onClick={() => apagar(o.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
      </div>
      
      {expandido && (
        <div className="bg-slate-50 border-t border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Pontos de embarque atendidos por este ônibus</p>
          {localidades.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma localidade cadastrada no sistema.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {localidades.map(loc => (
                <label key={loc.id} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-200 cursor-pointer hover:border-brand-300">
                  <input 
                    type="checkbox" 
                    checked={locaisAtuais.includes(loc.id)}
                    onChange={(e) => toggleLocalidade(loc.id, e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                  />
                  <span className="truncate">{loc.nome}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Frota() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [criando, setCriando] = useState(false);

  const { data: frota, isLoading } = useQuery({
    queryKey: ["painel-frota"],
    queryFn: async () => {
      const { data } = await supabase.from("Onibus").select("id,nome,placa,capacidade,motorista,ativo,destinoId,destino:Destino(nome), locais:OnibusLocalidade(localidadeId, prioridade, localidade:Localidade(nome))").order("nome");
      return (data as Onibus[]) ?? [];
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

  const { data: localidades } = useQuery({
    queryKey: ["localidades-todas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Localidade").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Localidade[]) ?? [];
    },
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["painel-frota"] });

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await supabase.from("Onibus").insert({
      id: crypto.randomUUID(), nome: f.get("nome"), placa: (f.get("placa") as string) || null,
      capacidade: Number(f.get("capacidade")) || 0, motorista: (f.get("motorista") as string) || null,
      ativo: true, destinoId: f.get("destinoId"), secretariaId: perfil?.secretariaId ?? null,
    });
    setCriando(false);
    invalidar();
  }

  async function toggleAtivo(o: Onibus) {
    await supabase.from("Onibus").update({ ativo: !o.ativo }).eq("id", o.id);
    invalidar();
  }
  async function salvarCap(id: string, capacidade: number) {
    await supabase.from("Onibus").update({ capacidade }).eq("id", id);
    invalidar();
  }
  async function apagar(id: string) {
    if (!window.confirm("Remover este ônibus?")) return;
    await supabase.from("Onibus").delete().eq("id", id);
    invalidar();
  }

  const cls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Frota</h1>
        </div>
        <button onClick={() => setCriando((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900">
          <Plus className="h-4 w-4" /> Novo ônibus
        </button>
      </div>
      <p className="text-sm text-slate-500">A capacidade de cada ônibus alimenta a alocação da fila (confirmados × espera).</p>

      {criando && (
        <form onSubmit={criar} className="grid gap-2 rounded-xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2">
          <input name="nome" placeholder="Nome (ex.: Ônibus Itaíba)" required className={cls} />
          <input name="placa" placeholder="Placa" className={cls} />
          <input name="capacidade" type="number" min={1} placeholder="Capacidade" required className={cls} />
          <input name="motorista" placeholder="Motorista" className={cls} />
          <select name="destinoId" required defaultValue="" className={cls}>
            <option value="" disabled>Rota…</option>
            {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white">Adicionar</button>
        </form>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (frota ?? []).length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Nenhum ônibus cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {(frota ?? []).map((o) => (
            <OnibusCard 
              key={o.id} o={o} salvarCap={salvarCap} toggleAtivo={toggleAtivo} apagar={apagar} 
              localidades={localidades ?? []} 
            />
          ))}
        </div>
      )}
    </div>
  );
}
