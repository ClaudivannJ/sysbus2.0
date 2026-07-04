import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Check, X, Bus, WifiOff, CloudUpload } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { EstadoEnquete } from "./fila";
import FilaAoVivo from "./FilaAoVivo";
import ChamadaAoVivo, { type PontoChamada } from "./ChamadaAoVivo";
import AvisoSemViagem, { dataExtenso } from "../components/AvisoSemViagem";
import { useOnline, cacheSalvar, cacheLer, salvarPendente, lerPendente, limparPendente, type AcaoEnquete } from "../lib/offline";

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

// Faixa da semana: mostra a semana atual com o NÚMERO do dia em cada bolinha, os dias
// em que a rota opera destacados e HOJE em azul. Informativo (a votação é do dia atual).
const DIAS_ISO = [
  { iso: 1, l: "Seg" }, { iso: 2, l: "Ter" }, { iso: 3, l: "Qua" }, { iso: 4, l: "Qui" },
  { iso: 5, l: "Sex" }, { iso: 6, l: "Sáb" }, { iso: 7, l: "Dom" },
];
function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function FaixaSemana({ diasSemana, horarioSaida, selDia, onSelecionar }: {
  diasSemana?: number[]; horarioSaida?: string | null;
  selDia?: string | null; onSelecionar?: (dataStr: string, ehHoje: boolean) => void;
}) {
  if (!diasSemana || diasSemana.length === 0) return null;
  const hoje = new Date();
  const hojeIso = hoje.getDay() === 0 ? 7 : hoje.getDay();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (hojeIso - 1));
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <div className="flex justify-between gap-1">
        {DIAS_ISO.map((d) => {
          const opera = diasSemana.includes(d.iso);
          const ehHoje = d.iso === hojeIso;
          const data = new Date(segunda);
          data.setDate(segunda.getDate() + (d.iso - 1));
          const ds = isoLocal(data);
          const selecionado = selDia ? ds === selDia : ehHoje;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onSelecionar?.(ds, ehHoje)}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <span className={`text-[10px] font-medium uppercase ${selecionado ? "text-brand-700" : "text-slate-400"}`}>{d.l}</span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors ${
                  selecionado
                    ? "bg-brand-700 text-white ring-2 ring-brand-700"
                    : opera
                      ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                      : "bg-slate-50 text-slate-300 ring-1 ring-slate-100 hover:bg-slate-100"
                }`}
              >
                {String(data.getDate()).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center justify-center gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-200" /> opera</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" /> sem transporte</span>
        {horarioSaida ? <span>· saída {horarioSaida}</span> : null}
      </p>
      <p className="mt-1 text-center text-[10px] text-slate-300">toque num dia para ver quem foi (passado) ou quando abre (futuro)</p>
    </div>
  );
}

// Visão de um DIA selecionado na faixa: passado = quem foi (histórico); futuro = aviso amigável.
interface DiaPayload {
  modo: "HISTORICO" | "FUTURO";
  viagem?: { id: string; horario: string } | null;
  fila?: { itens: { reservaId: string; nome: string; localidade: string | null; status: string }[] } | null;
  motivo?: string | null; abreHora?: string | null; horarioSaida?: string | null;
}
function DiaView({ diaSel }: { diaSel: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["enquete-dia", diaSel],
    queryFn: async (): Promise<DiaPayload | null> => {
      const { data } = await supabase.functions.invoke("enquete", { body: { action: "estado", data: diaSel } });
      return (data as DiaPayload) ?? null;
    },
  });
  const titulo = dataExtenso(diaSel);
  if (isLoading) return <p className="py-8 text-center text-sm text-slate-400">Carregando {titulo}…</p>;
  if (!data) return <p className="py-8 text-center text-sm text-slate-400">Não foi possível carregar esse dia.</p>;

  if (data.modo === "FUTURO") {
    const msg = ({
      FORA_DE_OPERACAO: "Não há transporte nesse dia (fora dos dias de operação da rota).",
      FERIADO: "Feriado ou recesso nesse dia — não haverá transporte.",
      SEM_ONIBUS: "Não há ônibus ativo para a rota nesse dia.",
    } as Record<string, string>)[data.motivo ?? ""] ?? `A votação desse dia será lançada às ${data.abreHora ?? data.horarioSaida ?? "—"}.`;
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <p className="text-base font-semibold capitalize text-slate-800">{titulo}</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{msg}</p>
      </div>
    );
  }
  // HISTÓRICO
  const foram = (data.fila?.itens ?? []).filter((i) => i.status === "CONFIRMADA");
  if (!data.viagem) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
        <p className="text-base font-semibold capitalize text-slate-800">{titulo}</p>
        <p className="mt-1 text-sm text-slate-500">Não houve viagem nesse dia.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-base font-semibold capitalize text-slate-800">{titulo}</p>
      <p className="mt-0.5 text-sm text-slate-500">Foram <strong>{foram.length}</strong> aluno(s) · saída {data.viagem.horario}</p>
      <ul className="mt-3 divide-y divide-slate-50">
        {foram.map((i) => (
          <li key={i.reservaId} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700">{i.nome}</span>
            <span className="text-xs text-slate-400">{i.localidade ?? "—"}</span>
          </li>
        ))}
        {foram.length === 0 && <li className="py-2 text-sm text-slate-400">Ninguém confirmou nesse dia.</li>}
      </ul>
    </div>
  );
}

function BannerConexao({ online, pendente }: { online: boolean; pendente: AcaoEnquete | null }) {
  if (!online) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-slate-800 px-3 py-2.5 text-sm text-white">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
        <p>Você está <strong>offline</strong> — o app continua funcionando. Seu voto será enviado assim que a internet voltar. A posição na fila é definida quando o voto chega ao servidor.</p>
      </div>
    );
  }
  if (pendente) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">
        <CloudUpload className="h-4 w-4 shrink-0 animate-pulse text-amber-600" />
        <p>Enviando seu voto pendente…</p>
      </div>
    );
  }
  return null;
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
  const online = useOnline();
  const [estado, setEstado] = useState<EstadoEnquete | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [intencao, setIntencao] = useState<Intencao>("IDA_VOLTA");
  const [ponto, setPonto] = useState<string>("");
  const [pendente, setPendente] = useState<AcaoEnquete | null>(() => lerPendente());
  const [diaSel, setDiaSel] = useState<string | null>(null); // dia selecionado na faixa (null = hoje)
  const selecionarDia = useCallback((ds: string, ehHoje: boolean) => setDiaSel(ehHoje ? null : ds), []);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  function aplicarEstado(e: EstadoEnquete) {
    setEstado(e);
    setIntencao(intencaoDe(e.minhaReserva));
    setPonto((p) => p || e.localidadeId || e.localidades[0]?.id || "");
    cacheSalvar("enquete", e); // p/ mostrar offline
  }

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("enquete", { body: { action: "estado" } });
    if (!error && data) {
      const e = data as EstadoEnquete;
      setEstado(e);
      setIntencao(intencaoDe(e.minhaReserva));
      setPonto(e.localidadeId ?? e.localidades[0]?.id ?? "");
      cacheSalvar("enquete", e);
    } else {
      // offline / falha → usa a última resposta guardada
      const cache = cacheLer<EstadoEnquete>("enquete");
      if (cache && !estado) { setEstado(cache); setIntencao(intencaoDe(cache.minhaReserva)); setPonto(cache.localidadeId ?? cache.localidades[0]?.id ?? ""); }
    }
    setCarregando(false);
  }, [estado]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // envia à Edge Function; distingue erro de REDE (offline) de erro do servidor (mensagem)
  async function enviar(a: "confirmar" | "cancelar", inte: string, loc: string) {
    const { data, error } = await supabase.functions.invoke("enquete", { body: { action: a, intencao: inte, localidadeId: loc } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (!ctx) return { ok: false as const, rede: true as const };
      let msg = "Não foi possível registrar sua resposta.";
      try { msg = (await ctx.json()).error ?? msg; } catch { /* */ }
      return { ok: false as const, msg };
    }
    return { ok: true as const, data: data as EstadoEnquete };
  }

  // registra a ação offline (pendente) e reflete otimista na tela
  const registrarPendente = useCallback((a: "confirmar" | "cancelar", inte: Intencao, loc: string) => {
    const obj: AcaoEnquete = { action: a, intencao: inte, localidadeId: loc, em: Date.now() };
    salvarPendente(obj);
    setPendente(obj);
    setEstado((prev) => prev ? {
      ...prev,
      minhaReserva: a === "confirmar"
        ? { status: "CONFIRMADA", vaiIda: inte !== "SO_VOLTA", vaiVolta: inte !== "SO_IDA" }
        : null,
    } : prev);
  }, []);

  // ao reconectar, envia a ação pendente (a posição é definida na CHEGADA ao servidor)
  useEffect(() => {
    if (!online) return;
    const p = lerPendente();
    if (!p) return;
    (async () => {
      const r = await enviar(p.action, p.intencao ?? "IDA_VOLTA", p.localidadeId ?? "");
      if (r.ok) { limparPendente(); setPendente(null); if (r.data) aplicarEstado(r.data); }
    })();
  }, [online]);

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
    setErro(null);
    // offline: guarda como pendente e envia ao reconectar (posição = chegada ao servidor)
    if (!online) { registrarPendente(action, intencao, ponto); return; }
    setAcao(true);
    const r = await enviar(action, intencao, ponto);
    setAcao(false);
    if (r.ok) {
      limparPendente(); setPendente(null);
      if (r.data) aplicarEstado(r.data);
    } else if (r.rede) {
      // caiu a rede no meio → vira pendente
      registrarPendente(action, intencao, ponto);
    } else {
      setErro(r.msg ?? "Não foi possível registrar sua resposta.");
    }
  }

  if (carregando) {
    return <p className="py-10 text-center text-sm text-slate-400">Carregando viagem de hoje…</p>;
  }

  // dia selecionado na faixa (passado = quem foi; futuro = aviso) — só leitura
  if (diaSel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Outro dia</h1>
          <button onClick={() => setDiaSel(null)} className="text-sm font-medium text-brand-700 hover:underline">Ver hoje</button>
        </div>
        <FaixaSemana diasSemana={estado?.diasSemana} horarioSaida={estado?.horarioSaida} selDia={diaSel} onSelecionar={selecionarDia} />
        <DiaView diaSel={diaSel} />
      </div>
    );
  }

  if (!estado?.viagem) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-bold text-slate-900">Viagem de hoje</h1>
        <BannerConexao online={online} pendente={pendente} />
        <FaixaSemana diasSemana={estado?.diasSemana} horarioSaida={estado?.horarioSaida} selDia={null} onSelecionar={selecionarDia} />
        <AvisoSemViagem
          motivo={estado?.motivo}
          proximaData={estado?.proximaData}
          descricaoExcecao={estado?.descricaoExcecao}
          horarioSaida={estado?.horarioSaida}
          contexto="aluno"
        />
      </div>
    );
  }

  const confirmada = estado.minhaReserva?.status === "CONFIRMADA";
  // "aberta" recalculada pelo RELÓGIO (abreEm/fechaEm) → a enquete abre/fecha no horário
  // configurado mesmo offline e sem depender de refetch.
  const abreMs = estado.viagem?.abreEm ? new Date(estado.viagem.abreEm).getTime() : null;
  const fechaMs = estado.viagem?.fechaEm ? new Date(estado.viagem.fechaEm).getTime() : null;
  const statusOk = estado.viagem?.status ? estado.viagem.status === "ABERTA" : true;
  const abertaAgora = statusOk && (abreMs === null || agora >= abreMs) && (fechaMs === null || agora < fechaMs);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Viagem de hoje</h1>
        <span className="inline-flex items-center gap-1 text-sm text-slate-500">
          <CalendarCheck className="h-4 w-4" />
          saída {estado.viagem.horario}
        </span>
      </div>

      <FaixaSemana diasSemana={estado.diasSemana} horarioSaida={estado.horarioSaida} selDia={null} onSelecionar={selecionarDia} />
      <BannerConexao online={online} pendente={pendente} />

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
            {abertaAgora ? "Você pode desistir e votar de novo enquanto a enquete estiver aberta." : "A enquete está encerrada. Você ainda pode desistir da vaga."}
          </p>
          <button
            onClick={() => agir("cancelar")}
            disabled={acao}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Desistir da vaga
          </button>
        </div>
      ) : !abertaAgora ? (
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
