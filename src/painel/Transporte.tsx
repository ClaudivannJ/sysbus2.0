import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, UserPlus, Search, Megaphone, Bus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import FilaAoVivo from "../portal/FilaAoVivo";
import ChamadaAoVivo, { type PontoChamada } from "../portal/ChamadaAoVivo";
import type { DadosFila } from "../portal/fila";
import AvisoSemViagem, { type MotivoSemViagem } from "../components/AvisoSemViagem";

interface Rota { id: string; nome: string }
interface AlunoLite { id: string; nome: string; cpf: string }
interface EstadoTransp {
  viagem: { id: string; horario: string; abreEm?: string | null } | null;
  fila: DadosFila | null; aberta: boolean;
  motivo?: MotivoSemViagem; proximaData?: string | null; descricaoExcecao?: string | null; horarioSaida?: string | null;
  frota?: { ativos: number; capacidade: number };
}

export default function Transporte() {
  const { perfil } = useAuth();
  const [rotaId, setRotaId] = useState("");
  const [busca, setBusca] = useState("");
  const [add, setAdd] = useState(false);

  const { data: rotas } = useQuery({
    queryKey: ["transp-rotas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });
  useEffect(() => { if (!rotaId && rotas?.length) setRotaId(rotas[0].id); }, [rotas, rotaId]);

  const { data: estado, isFetching, refetch } = useQuery({
    queryKey: ["transp-estado", rotaId],
    enabled: Boolean(rotaId),
    queryFn: async (): Promise<EstadoTransp | null> => {
      const { data } = await supabase.functions.invoke("transporte", { body: { action: "estado", destinoId: rotaId } });
      return (data as EstadoTransp) ?? null;
    },
  });

  const { data: chamada } = useQuery({
    queryKey: ["transp-chamada", rotaId],
    enabled: Boolean(rotaId),
    refetchInterval: 20000,
    queryFn: async (): Promise<{ intervaloSegundos: number; pontos: PontoChamada[] } | null> => {
      const { data } = await supabase.functions.invoke("chamada", { body: { action: "estado", destinoId: rotaId } });
      return data ?? null;
    },
  });

  const { data: alunos } = useQuery({
    queryKey: ["transp-alunos"],
    queryFn: async () => {
      const { data } = await supabase.from("Aluno").select("id,nome,cpf").eq("status", "ATIVO").order("nome");
      return (data as AlunoLite[]) ?? [];
    },
  });
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return (alunos ?? []).slice(0, 8);
    return (alunos ?? []).filter((a) => a.nome.toLowerCase().includes(q) || a.cpf.includes(q)).slice(0, 8);
  }, [alunos, busca]);

  async function adicionar(alunoId: string) {
    await supabase.functions.invoke("transporte", { body: { action: "adicionar", destinoId: rotaId, alunoId } });
    setBusca("");
    setAdd(false);
    refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-brand-600" />
          <h1 className="text-lg font-bold text-slate-900">Viagem ao vivo</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          {estado?.aberta && (
            <button onClick={() => setAdd((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800">
              <UserPlus className="h-4 w-4" /> Inserir aluno
            </button>
          )}
        </div>
      </div>

      {add && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="mb-2 text-sm font-medium text-slate-700">Inserir aluno na fila (entra na posição de agora)</p>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou CPF" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" />
          </div>
          <ul className="divide-y divide-slate-100">
            {filtrados.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{a.nome} <span className="text-xs text-slate-400">· {a.cpf}</span></span>
                <button onClick={() => adicionar(a.id)} className="rounded-lg border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">Inserir</button>
              </li>
            ))}
            {filtrados.length === 0 && <li className="py-2 text-sm text-slate-400">Nenhum aluno encontrado.</li>}
          </ul>
        </div>
      )}

      {!estado?.viagem ? (
        isFetching ? (
          <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Carregando…</p>
        ) : (
          <AvisoSemViagem
            motivo={estado?.motivo}
            proximaData={estado?.proximaData}
            descricaoExcecao={estado?.descricaoExcecao}
            horarioSaida={estado?.horarioSaida}
            contexto="secretaria"
          />
        )
      ) : (
        <>
          {estado.frota && estado.frota.ativos <= 1 && (
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
              <Bus className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-amber-800">
                {estado.frota.ativos === 0
                  ? "Nenhum ônibus ativo nesta rota hoje — ative a frota em Frota para abrir vagas."
                  : `Hoje só há 1 ônibus ativo nesta rota (capacidade ${estado.frota.capacidade}). Os demais estão inativos.`}
              </p>
            </div>
          )}
          {chamada && chamada.pontos.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Megaphone className="h-4 w-4 text-brand-600" /> Chamada</h2>
              <ChamadaAoVivo intervaloSegundos={chamada.intervaloSegundos} pontos={chamada.pontos} />
            </div>
          )}
          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Fila ao vivo</h2>
            <FilaAoVivo viagemId={estado.viagem.id} inicial={estado.fila ?? { confirmados: 0, emEspera: 0, naFila: 0, voltam: 0, itens: [] }} />
          </div>
        </>
      )}
    </div>
  );
}
