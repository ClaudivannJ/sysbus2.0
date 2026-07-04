import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bus, TrendingDown, RefreshCw, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Rota { id: string; nome: string }
interface PorOnibus { nome: string; capacidade: number; confirmadosIda: number; embarcadosIda: number }
interface Contagem {
  viagem: { id: string; horario: string } | null; rota?: string;
  capacidadeUmOnibus: number; capacidadeTotal: number; qtdOnibus: number;
  porOnibus: PorOnibus[];
  ida: { confirmados: number; embarcados: number };
  volta: { confirmados: number; embarcados: number };
  recomendacao: "UM_ONIBUS" | "MANTER";
  mensagem: string;
}

function Metric({ label, valor, sub }: { label: string; valor: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-2xl font-bold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export default function Embarque() {
  const { perfil } = useAuth();
  const [rotaId, setRotaId] = useState("");

  const { data: rotas } = useQuery({
    queryKey: ["embarque-rotas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });
  useEffect(() => { if (!rotaId && rotas && rotas.length) setRotaId(rotas[0].id); }, [rotas, rotaId]);

  const { data: c, isFetching, refetch } = useQuery({
    queryKey: ["contagem", rotaId],
    enabled: Boolean(rotaId),
    refetchInterval: 8000, // quase ao vivo (embarque muda quando o monitor escaneia)
    queryFn: async (): Promise<Contagem | null> => {
      const { data } = await supabase.functions.invoke("contagem-embarque", { body: { destinoId: rotaId } });
      return (data as Contagem) ?? null;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Embarque</h1>
        </div>
        <div className="flex items-center gap-2">
          <select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
          <button onClick={() => refetch()} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50" title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!c?.viagem ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Sem viagem hoje nesta rota.</p>
      ) : (
        <>
          {/* recomendação inteligente 1 vs 2 ônibus */}
          {c.recomendacao === "UM_ONIBUS" ? (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <TrendingDown className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Pode enviar apenas 1 ônibus</p>
                <p className="text-sm text-emerald-700">{c.mensagem}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <Bus className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" />
              <div>
                <p className="font-semibold text-slate-700">Frota necessária: {c.qtdOnibus} ônibus</p>
                <p className="text-sm text-slate-500">{c.mensagem}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Confirmados (ida)" valor={c.ida.confirmados} />
            <Metric label="Embarcados (ida)" valor={c.ida.embarcados} sub={`de ${c.ida.confirmados}`} />
            <Metric label="Confirmados (volta)" valor={c.volta.confirmados} />
            <Metric label="Embarcados (volta)" valor={c.volta.embarcados} sub={`de ${c.volta.confirmados}`} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Por ônibus (ida)</h2>
            <div className="space-y-2">
              {c.porOnibus.map((o) => {
                const cheio = o.confirmadosIda >= o.capacidade;
                const pct = o.capacidade ? Math.min(100, Math.round((o.confirmadosIda / o.capacidade) * 100)) : 0;
                return (
                  <div key={o.nome} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{o.nome}</span>
                      <span className="text-slate-500">
                        {o.confirmadosIda}/{o.capacidade} confirmados · <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-3 w-3" />{o.embarcadosIda} embarcados</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${cheio ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
