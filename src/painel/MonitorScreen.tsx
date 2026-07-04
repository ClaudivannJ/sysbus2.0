import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bus, Check, LogOut, Megaphone, ScanLine, MapPin, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import ChamadaAoVivo, { type PontoChamada } from "../portal/ChamadaAoVivo";
import EmbarqueScanner, { type ResultadoScan } from "../components/EmbarqueScanner";

interface Item {
  reservaId: string; nome: string; fotoUrl: string | null; onibusNome: string | null;
  posicao: number | null; embarcouIda: boolean; embarcouVolta: boolean;
}
interface Ponto { ponto: string; itens: Item[] }
interface Falta { nome: string; fotoUrl: string | null }
interface PontoItin { id: string; sentido: "IDA" | "VOLTA"; ordem: number; nome: string; faltamQtd: number; faltam: Falta[] }
interface Estado {
  viagem: { id: string; horario: string; pontoAtualId: string | null; sentidoAtual: string | null } | null;
  rota?: string; pontos: Ponto[]; nfcAtivo?: boolean; itinerario?: PontoItin[]; exibirQuemFalta?: string;
}
interface Rota { id: string; nome: string }

function iniciais(n: string) { return n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

export default function MonitorScreen() {
  const { perfil, sair } = useAuth();
  const qc = useQueryClient();
  const [destinoId, setDestinoId] = useState("");
  const [sentido, setSentido] = useState<"IDA" | "VOLTA">("IDA");

  const { data: rotas } = useQuery({
    queryKey: ["monitor-rotas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });

  useEffect(() => {
    if (!destinoId && rotas && rotas.length > 0) setDestinoId(rotas[0].id);
  }, [rotas, destinoId]);

  const { data: estado, isLoading } = useQuery({
    queryKey: ["monitor-estado", destinoId],
    enabled: Boolean(destinoId),
    refetchInterval: 8000,
    queryFn: async (): Promise<Estado> => {
      const { data } = await supabase.functions.invoke("monitor", { body: { action: "estado", destinoId } });
      return (data as Estado) ?? { viagem: null, pontos: [] };
    },
  });

  const { data: chamada, refetch: refetchChamada } = useQuery({
    queryKey: ["monitor-chamada", destinoId],
    enabled: Boolean(destinoId),
    refetchInterval: 20000,
    queryFn: async (): Promise<{ intervaloSegundos: number; pontos: PontoChamada[] } | null> => {
      const { data } = await supabase.functions.invoke("chamada", { body: { action: "estado", destinoId } });
      return data ?? null;
    },
  });

  const [iniciando, setIniciando] = useState(false);
  async function iniciarChamada() {
    if (!chamada?.pontos.length) return;
    if (!window.confirm("Iniciar a chamada agora (antes do horário)?")) return;
    setIniciando(true);
    await supabase.functions.invoke("chamada", { body: { action: "iniciar", destinoId } });
    setIniciando(false);
    refetchChamada();
  }

  async function alternar(it: Item) {
    const jaEmbarcou = sentido === "IDA" ? it.embarcouIda : it.embarcouVolta;
    await supabase.functions.invoke("monitor", {
      body: { action: jaEmbarcou ? "desembarcar" : "embarcar", reservaId: it.reservaId, sentido },
    });
    qc.invalidateQueries({ queryKey: ["monitor-estado", destinoId] });
  }

  // ---- scanner (QR/NFC) ----
  const [scannerAberto, setScannerAberto] = useState(false);
  const [feedback, setFeedback] = useState<ResultadoScan | null>(null);
  const escaneando = useRef(false);
  async function aoEscanear(texto: string) {
    if (escaneando.current) return; // uma leitura por vez
    escaneando.current = true;
    try {
      const { data, error } = await supabase.functions.invoke("monitor", {
        body: { action: "escanear", destinoId, sentido, texto },
      });
      if (error || !data) {
        setFeedback({ resultado: "ERRO", mensagem: "Falha ao registrar. Tente de novo." });
      } else {
        setFeedback(data as ResultadoScan);
        if ((data as ResultadoScan).resultado === "OK") qc.invalidateQueries({ queryKey: ["monitor-estado", destinoId] });
      }
    } finally {
      setTimeout(() => { escaneando.current = false; }, 900);
    }
  }

  async function definirPonto(id: string | null) {
    await supabase.functions.invoke("monitor", { body: { action: "definir-ponto", destinoId, pontoRotaId: id } });
    qc.invalidateQueries({ queryKey: ["monitor-estado", destinoId] });
  }

  const itinSentido = (estado?.itinerario ?? []).filter((p) => p.sentido === sentido).sort((a, b) => a.ordem - b.ordem);
  const pontoAtualId = estado?.viagem?.pontoAtualId ?? null;
  const pontoAtual = itinSentido.find((p) => p.id === pontoAtualId) ?? null;
  const exibir = estado?.exibirQuemFalta ?? "QTD_NOME";

  const total = (estado?.pontos ?? []).reduce((s, p) => s + p.itens.length, 0);
  const embarcados = (estado?.pontos ?? []).reduce(
    (s, p) => s + p.itens.filter((i) => (sentido === "IDA" ? i.embarcouIda : i.embarcouVolta)).length, 0,
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-white"><Bus className="h-5 w-5" /></div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-900">Monitor</p>
            <p className="text-[11px] text-slate-300">{perfil?.nome}</p>
          </div>
        </div>
        <button onClick={() => sair()} className="inline-flex items-center gap-1 text-sm text-slate-300"><LogOut className="h-4 w-4" /> Sair</button>
      </header>

      <div className="space-y-3 border-b border-slate-200 bg-white p-4">
        <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
        <div className="flex gap-2">
          {(["IDA", "VOLTA"] as const).map((s) => (
            <button key={s} onClick={() => setSentido(s)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium ring-1 ${sentido === s ? "bg-brand-800 text-white ring-slate-900" : "bg-white text-slate-600 ring-slate-300"}`}>
              {s === "IDA" ? "Ida" : "Volta"}
            </button>
          ))}
        </div>
        {estado?.viagem && (
          <button onClick={() => { setFeedback(null); setScannerAberto(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            <ScanLine className="h-4 w-4" /> Escanear carteirinha ({sentido === "IDA" ? "ida" : "volta"})
          </button>
        )}
      </div>

      <EmbarqueScanner
        aberto={scannerAberto}
        nfcAtivo={Boolean(estado?.nfcAtivo)}
        feedback={feedback}
        onTexto={aoEscanear}
        onFechar={() => setScannerAberto(false)}
      />

      <main className="flex-1 p-4">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
        ) : !estado?.viagem ? (
          <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            Sem viagem hoje nesta rota.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Saída {estado.viagem.horario} · <strong>{embarcados}/{total}</strong> embarcados ({sentido === "IDA" ? "ida" : "volta"})
            </p>

            {itinSentido.length > 0 && (
              <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4 text-brand-600" /> Itinerário — onde o ônibus está</h2>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {itinSentido.map((p, i) => {
                    const atual = p.id === pontoAtualId;
                    return (
                      <button key={p.id} onClick={() => definirPonto(atual ? null : p.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${atual ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"}`}>
                        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${atual ? "bg-white/25" : "bg-brand-100 text-brand-700"}`}>{i + 1}</span>
                        {p.nome}
                        {p.faltamQtd > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold ${atual ? "bg-white/25" : "bg-amber-100 text-amber-700"}`}>{p.faltamQtd}</span>}
                      </button>
                    );
                  })}
                </div>
                {pontoAtual ? (
                  <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                    {pontoAtual.faltamQtd === 0 ? (
                      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check className="h-4 w-4" /> Todos embarcaram em {pontoAtual.nome} — pode seguir.</p>
                    ) : (
                      <>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Users className="h-4 w-4 text-amber-600" /> Faltam {pontoAtual.faltamQtd} em {pontoAtual.nome}</p>
                        {exibir !== "QTD" && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {pontoAtual.faltam.map((f, k) => (
                              <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200">
                                {exibir === "PERFIL" && (
                                  <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700">
                                    {f.fotoUrl ? <img src={f.fotoUrl} alt="" className="h-full w-full object-cover" /> : iniciais(f.nome)}
                                  </span>
                                )}
                                {f.nome}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Toque no ponto onde o ônibus está para acompanhar quem falta.</p>
                )}
              </div>
            )}

            {chamada && chamada.pontos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Megaphone className="h-4 w-4 text-brand-600" /> Chamada</h2>
                  <button onClick={iniciarChamada} disabled={iniciando} className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-60">
                    {iniciando ? "Iniciando…" : "Iniciar agora"}
                  </button>
                </div>
                <ChamadaAoVivo intervaloSegundos={chamada.intervaloSegundos} pontos={chamada.pontos} />
              </div>
            )}
            {estado.pontos.map((p) => (
              <div key={p.ponto}>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">{p.ponto}</h2>
                <div className="space-y-2">
                  {p.itens.map((it) => {
                    const emb = sentido === "IDA" ? it.embarcouIda : it.embarcouVolta;
                    return (
                      <button key={it.reservaId} onClick={() => alternar(it)}
                        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ring-1 ${emb ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}>
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                          {it.fotoUrl ? <img src={it.fotoUrl} alt="" className="h-full w-full object-cover" /> : iniciais(it.nome)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{it.nome}</p>
                          <p className="text-xs text-slate-400">{it.onibusNome ?? "—"}{it.posicao ? ` · ${it.posicao}º` : ""}</p>
                        </div>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${emb ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-300"}`}>
                          <Check className="h-4 w-4" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
