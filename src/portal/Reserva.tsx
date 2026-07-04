import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Check, X, Bus } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { EstadoEnquete } from "./fila";
import FilaAoVivo from "./FilaAoVivo";
import ChamadaAoVivo, { type PontoChamada } from "./ChamadaAoVivo";

type Intencao = "IDA_VOLTA" | "SO_IDA" | "SO_VOLTA";
type PosicaoOnibus = { nome: string; sentido: "IDA" | "VOLTA"; faltamQtd: number; meuPonto: boolean };

const LABEL_INTENCAO: Record<Intencao, string> = {
  IDA_VOLTA: "Vai e volta",
  SO_IDA: "Só ida",
  SO_VOLTA: "Só volta",
};

function intencaoDe(r: { vaiIda: boolean; vaiVolta: boolean } | null): Intencao {
  if (!r) return "IDA_VOLTA";
  if (r.vaiIda && !r.vaiVolta) return "SO_IDA";
  if (!r.vaiIda && r.vaiVolta) return "SO_VOLTA";
  return "IDA_VOLTA";
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
}
function contagem(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min ${String(seg).padStart(2, "0")}s`;
}

export default function Reserva() {
  const [estado, setEstado] = useState<EstadoEnquete | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [intencao, setIntencao] = useState<Intencao>("IDA_VOLTA");
  const [ponto, setPonto] = useState<string>("");
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("enquete", { body: { action: "estado" } });
    if (!error && data) {
      const e = data as EstadoEnquete;
      setEstado(e);
      setIntencao(intencaoDe(e.minhaReserva));
      setPonto(e.localidadeId ?? e.localidades[0]?.id ?? "");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // chamada ao vivo (aparece p/ o aluno; refetch p/ pegar novos confirmados / início antecipado)
  const { data: chamada } = useQuery({
    queryKey: ["chamada-aluno"],
    refetchInterval: 15000,
    queryFn: async (): Promise<{ intervaloSegundos: number; pontos: PontoChamada[]; meuReservaId: string | null; posicaoOnibus: PosicaoOnibus | null } | null> => {
      const { data } = await supabase.functions.invoke("chamada", { body: { action: "estado" } });
      return data ?? null;
    },
  });

  async function agir(action: "confirmar" | "cancelar") {
    setAcao(true);
    setErro(null);
    const { data, error } = await supabase.functions.invoke("enquete", {
      body: { action, intencao, localidadeId: ponto },
    });
    setAcao(false);
    // a Edge Function devolve mensagem de erro no corpo (ex.: enquete encerrada)
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let msg = "Não foi possível registrar sua resposta.";
      try {
        if (ctx) msg = (await ctx.json()).error ?? msg;
      } catch { /* ignore */ }
      setErro(msg);
      return;
    }
    if (data) {
      setEstado(data as EstadoEnquete);
      setIntencao(intencaoDe((data as EstadoEnquete).minhaReserva));
    }
  }

  if (carregando) {
    return <p className="py-10 text-center text-sm text-slate-400">Carregando viagem de hoje…</p>;
  }

  if (!estado?.viagem) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold text-slate-900">Reserva de vaga</h1>
        <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          Não há viagem programada para hoje na sua rota.
        </p>
      </div>
    );
  }

  const confirmada = estado.minhaReserva?.status === "CONFIRMADA";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Viagem de hoje</h1>
        <span className="inline-flex items-center gap-1 text-sm text-slate-500">
          <CalendarCheck className="h-4 w-4" />
          saída {estado.viagem.horario}
        </span>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {!estado.autorizado ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Sua autorização do semestre ainda não está válida. Envie a documentação em{" "}
          <strong>Documentos</strong> para poder reservar.
        </p>
      ) : confirmada ? (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Check className="h-5 w-5" /> Presença confirmada · {LABEL_INTENCAO[intencaoDe(estado.minhaReserva)]}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {estado.aberta ? "Você pode desistir e votar de novo enquanto a enquete estiver aberta." : "A enquete está encerrada. Você ainda pode desistir da vaga."}
          </p>
          <button
            onClick={() => agir("cancelar")}
            disabled={acao}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Desistir da vaga
          </button>
        </div>
      ) : !estado.aberta ? (
        (() => {
          const abre = estado.viagem?.abreEm ? new Date(estado.viagem.abreEm).getTime() : null;
          const antes = abre !== null && agora < abre;
          return (
            <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
              <p className="text-base font-semibold text-slate-800">{antes ? "A votação ainda não abriu" : "A votação de hoje está encerrada"}</p>
              {antes ? (
                <p className="mt-1 text-sm text-slate-500">Abre às <strong className="text-slate-700">{hhmm(estado.viagem!.abreEm!)}</strong> · em {contagem(abre! - agora)}</p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Volte amanhã no horário de abertura.</p>
              )}
            </div>
          );
        })()
      ) : (
        <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Onde você embarca?</p>
            <select value={ponto} onChange={(e) => setPonto(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {estado.localidades.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">Sua viagem</p>
            <div className="flex gap-2">
              {(Object.keys(LABEL_INTENCAO) as Intencao[]).map((op) => (
                <button
                  key={op}
                  onClick={() => setIntencao(op)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${
                    intencao === op ? "bg-brand-800 text-white ring-brand-800" : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {LABEL_INTENCAO[op]}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => agir("confirmar")}
            disabled={acao || !ponto}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> {acao ? "Confirmando…" : "Confirmar presença"}
          </button>
        </div>
      )}

      {chamada?.posicaoOnibus && (
        <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${chamada.posicaoOnibus.meuPonto ? "bg-brand-50 ring-brand-200" : "bg-white ring-slate-200"}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Bus className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">
              Ônibus em <span className="text-brand-700">{chamada.posicaoOnibus.nome}</span>
              <span className="ml-1 text-xs font-normal text-slate-400">· {chamada.posicaoOnibus.sentido === "IDA" ? "ida" : "volta"}</span>
            </p>
            <p className="text-xs text-slate-500">
              {chamada.posicaoOnibus.faltamQtd === 0
                ? "Todos embarcaram neste ponto."
                : `Faltam ${chamada.posicaoOnibus.faltamQtd} para o ônibus seguir.`}
              {chamada.posicaoOnibus.meuPonto && <strong className="text-brand-700"> É o seu ponto agora.</strong>}
            </p>
          </div>
        </div>
      )}

      {chamada && chamada.pontos.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Chamada</h2>
          <ChamadaAoVivo intervaloSegundos={chamada.intervaloSegundos} pontos={chamada.pontos} meuReservaId={chamada.meuReservaId} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Fila ao vivo</h2>
        <FilaAoVivo
          viagemId={estado.viagem.id}
          inicial={estado.fila ?? { confirmados: 0, emEspera: 0, naFila: 0, voltam: 0, itens: [] }}
        />
      </div>
    </div>
  );
}
