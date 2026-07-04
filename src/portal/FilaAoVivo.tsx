import { useCallback, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useCanal } from "./useCanal";
import type { DadosFila, ItemFila } from "./fila";

function horaCurta(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
}
function iniciais(nome: string) {
  return nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ item, z }: { item: ItemFila; z?: number }) {
  const anel = item.status === "CONFIRMADA" ? "ring-emerald-400" : "ring-amber-400";
  return (
    <div
      title={`${item.nome}${item.status === "CONFIRMADA" ? " · confirmado" : " · em espera"}`}
      style={{ zIndex: z }}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 ring-2 ${anel}`}
    >
      {item.fotoUrl ? (
        <img src={item.fotoUrl} alt={item.nome} className="h-full w-full object-cover" />
      ) : (
        iniciais(item.nome)
      )}
    </div>
  );
}

interface Grupo { ponto: string; itens: ItemFila[]; confirmados: number; espera: number }

function agrupar(itens: ItemFila[]): Grupo[] {
  const mapa = new Map<string, ItemFila[]>();
  for (const i of itens) {
    const ponto = i.localidade ?? "Sem ponto definido";
    let lista = mapa.get(ponto);
    if (!lista) { lista = []; mapa.set(ponto, lista); }
    lista.push(i);
  }
  return [...mapa.entries()]
    .map(([ponto, lista]) => {
      const ordenada = [...lista].sort((a, b) => b.hora.localeCompare(a.hora));
      return {
        ponto, itens: ordenada,
        confirmados: ordenada.filter((i) => i.status === "CONFIRMADA").length,
        espera: ordenada.filter((i) => i.status === "ESPERA").length,
      };
    })
    .sort((a, b) => a.ponto.localeCompare(b.ponto));
}

const MAX_BOLHAS = 5;

function Badge({ tom, children }: { tom: "success" | "warning" | "brand" | "neutral"; children: React.ReactNode }) {
  const cls: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-amber-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls[tom]}`}>{children}</span>;
}

export default function FilaAoVivo({ viagemId, inicial }: { viagemId: string; inicial: DadosFila }) {
  const [dados, setDados] = useState<DadosFila>(inicial);
  const [pulso, setPulso] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const qtdRef = useRef(inicial.itens.length);

  const aplicar = useCallback((d: DadosFila) => {
    if (d.itens.length !== qtdRef.current) {
      qtdRef.current = d.itens.length;
      setPulso(true);
      setTimeout(() => setPulso(false), 700);
    }
    setDados(d);
  }, []);

  const atualizar = useCallback(
    async (payload?: unknown) => {
      const p = payload as Partial<DadosFila> | undefined;
      if (p && Array.isArray(p.itens)) {
        aplicar(p as DadosFila);
        return;
      }
      // fallback: refaz o estado via Edge Function (raro — só payload vazio/reconexão)
      const { data } = await supabase.functions.invoke("enquete", { body: { action: "estado" } });
      if (data?.fila) aplicar(data.fila as DadosFila);
    },
    [aplicar],
  );

  const aoVivo = useCanal(`fila:${viagemId}`, atualizar);
  const grupos = agrupar(dados.itens);
  const toggle = (ponto: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(ponto)) n.delete(ponto); else n.add(ponto);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tom="success">{dados.confirmados} confirmados</Badge>
        <Badge tom={dados.emEspera > 0 ? "warning" : "neutral"}>{dados.emEspera} em espera</Badge>
        <Badge tom="brand">{dados.voltam} voltam</Badge>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`h-2 w-2 rounded-full transition-opacity ${aoVivo ? "bg-emerald-500" : "bg-slate-300"} ${pulso ? "opacity-100" : "opacity-40"}`} />
          {aoVivo ? "ao vivo" : "atualizando…"}
        </span>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">
          Ninguém confirmou presença ainda.
        </div>
      ) : (
        grupos.map((g) => {
          const aberto = abertos.has(g.ponto);
          const bolhas = g.itens.slice(0, MAX_BOLHAS);
          const resto = g.itens.length - bolhas.length;
          return (
            <div key={g.ponto} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{g.ponto}</p>
                  <p className="text-xs text-slate-400">
                    {g.itens.length} confirmação(ões) · {g.confirmados} no ônibus
                    {g.espera > 0 && ` · ${g.espera} em espera`}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {bolhas.map((i, idx) => (
                    <Avatar key={i.reservaId} item={i} z={MAX_BOLHAS - idx} />
                  ))}
                </div>
                {resto > 0 && (
                  <div className="z-0 -ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500 ring-2 ring-white">
                    +{resto}
                  </div>
                )}
                {g.itens.length > 0 && (
                  <button onClick={() => toggle(g.ponto)} className="ml-3 text-xs font-medium text-brand-600 hover:underline">
                    {aberto ? "ocultar" : `ver todos (${g.itens.length})`}
                  </button>
                )}
              </div>
              {aberto && (
                <ul className="mt-3 divide-y divide-slate-50 border-t border-slate-100 pt-1">
                  {g.itens.map((i) => (
                    <li key={i.reservaId} className="flex items-center gap-3 py-2">
                      <Avatar item={i} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{i.nome}</p>
                        <p className="text-xs text-slate-400">votou às {horaCurta(i.hora)}</p>
                      </div>
                      {i.transbordo && <Badge tom="warning">transbordo</Badge>}
                      {i.status === "CONFIRMADA" ? (
                        <Badge tom="success">{i.onibusNome} · {i.posicao}º</Badge>
                      ) : (
                        <Badge tom="warning">espera</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
