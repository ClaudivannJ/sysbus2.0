import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Square, RotateCcw, CheckCircle2, Bus, Sparkles, X, Info } from "lucide-react";
import { supabase } from "../lib/supabase";

interface PontoRota {
  id: string;
  nome: string;
  ordem: number;
  sentido: "IDA" | "VOLTA";
}

interface ReservaSim {
  id: string;
  alunoId: string;
  nome: string;
  faculdade: string | null;
  embarcado: boolean;
}

export default function SimuladorViagem({
  destinoId,
  rotaNome,
  onFechar,
}: {
  destinoId: string;
  rotaNome: string;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const [sentido, setSentido] = useState<"IDA" | "VOLTA">("IDA");
  const [rodando, setRodando] = useState(false);
  const [pontoIdx, setPontoIdx] = useState(0);
  const [pontos, setPontos] = useState<PontoRota[]>([]);
  const [passageiros, setPassageiros] = useState<ReservaSim[]>([]);
  const [viagemId, setViagemId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("Pronto para iniciar a simulação.");
  const [carregando, setCarregando] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Inicializa os pontos e alunos da rota
  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      const { data: pts } = await supabase
        .from("PontoRota")
        .select("id, nome, ordem, sentido")
        .eq("destinoId", destinoId)
        .order("ordem");

      const ptsFiltrados = (pts ?? []).filter((p) => p.sentido === sentido);
      setPontos(ptsFiltrados);

      // Busca reservas existentes ou gera mock para o teste
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const amanha = new Date(inicio);
      amanha.setDate(amanha.getDate() + 1);

      let { data: v } = await supabase
        .from("Viagem")
        .select("id, pontoAtualId")
        .eq("destinoId", destinoId)
        .gte("data", inicio.toISOString())
        .lt("data", amanha.toISOString())
        .limit(1)
        .maybeSingle();

      // Se não existir viagem para hoje, cria uma viagem ativa para o teste
      if (!v) {
        const { data: novaV } = await supabase
          .from("Viagem")
          .insert({
            destinoId,
            data: inicio.toISOString(),
            horario: "17:30",
            status: "ABERTA",
            sentidoAtual: sentido,
          })
          .select("id, pontoAtualId")
          .single();
        v = novaV;
      }

      if (v) {
        setViagemId(v.id);
        const { data: res } = await supabase
          .from("Reserva")
          .select("id, alunoId, aluno:Aluno(nome, faculdade), embarques:Embarque(sentido)")
          .eq("viagemId", v.id)
          .eq("status", "CONFIRMADA");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lista: ReservaSim[] = (res ?? []).map((r: any) => ({
          id: r.id,
          alunoId: r.alunoId,
          nome: r.aluno?.nome ?? "Passageiro",
          faculdade: r.aluno?.faculdade ?? null,
          embarcado: (r.embarques ?? []).some((e: { sentido: string }) => e.sentido === sentido),
        }));

        setPassageiros(lista);
      }

      setCarregando(false);
    }

    carregar();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [destinoId, sentido]);

  // 2. Dispara o Realtime Broadcast e atualiza o banco no ponto atual
  async function avancarPonto(idx: number) {
    if (!viagemId || idx >= pontos.length) {
      setRodando(false);
      setStatusMsg("Viagem concluída! Todos os pontos foram percorridos.");
      return;
    }

    const ponto = pontos[idx];
    setPontoIdx(idx);
    setStatusMsg(`🚌 Ônibus chegou em: ${ponto.nome}... Processando embarques.`);

    // Atualiza ponto atual no banco
    await supabase
      .from("Viagem")
      .update({ pontoAtualId: ponto.id, sentidoAtual: sentido })
      .eq("id", viagemId);

    // Emite broadcast Realtime instantâneo para todos os alunos conectados
    const canal = supabase.channel(`monitor-viagem:${destinoId}`);
    await canal.send({
      type: "broadcast",
      event: "atualizacao",
      payload: { pontoAtualId: ponto.id, sentido, timestamp: Date.now() },
    });

    // Simula embarque de alunos vinculados a este ponto
    const passageirosNaoEmbarcados = passageiros.filter((p) => !p.embarcado);
    if (passageirosNaoEmbarcados.length > 0) {
      // Embarca os primeiros 2 ou 3 passageiros da fila neste ponto
      const paraEmbarcar = passageirosNaoEmbarcados.slice(0, 2);
      for (const p of paraEmbarcar) {
        await supabase.from("Embarque").insert({
          reservaId: p.id,
          sentido,
          horario: new Date().toISOString(),
        });
      }

      setPassageiros((ant) =>
        ant.map((item) =>
          paraEmbarcar.some((emb) => emb.id === item.id) ? { ...item, embarcado: true } : item
        )
      );

      // Dispara novo broadcast informando embarque concluído
      await canal.send({
        type: "broadcast",
        event: "embarque",
        payload: { destinoId, timestamp: Date.now() },
      });
    }

    qc.invalidateQueries({ queryKey: ["acompanhar-viagem-ao-vivo"] });
  }

  // 3. Iniciar Simulação Automática
  function iniciarSimulacao() {
    setRodando(true);
    let atual = 0;
    avancarPonto(atual);

    timerRef.current = setInterval(() => {
      atual += 1;
      if (atual < pontos.length) {
        avancarPonto(atual);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setRodando(false);
        setStatusMsg("🏁 Fim do percurso simulado.");
      }
    }, 5000); // Avança de ponto a cada 5 segundos
  }

  function pararSimulacao() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRodando(false);
    setStatusMsg("Simulação pausada.");
  }

  // 4. Limpar dados da simulação para manter produção limpa
  async function limparDados() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRodando(false);
    if (viagemId) {
      await supabase.from("Embarque").delete().eq("sentido", sentido);
      await supabase.from("Viagem").update({ pontoAtualId: null }).eq("id", viagemId);
    }
    setPassageiros((ant) => ant.map((p) => ({ ...p, embarcado: false })));
    setPontoIdx(0);
    setStatusMsg("Dados da simulação limpos com sucesso. Banco de dados restaurado!");
    qc.invalidateQueries({ queryKey: ["acompanhar-viagem-ao-vivo"] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-600 animate-pulse" />
            <div>
              <h2 className="text-base font-bold text-slate-800">Simulador de Viagem & Telemetria</h2>
              <p className="text-xs text-slate-500">Rota: {rotaNome}</p>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Simulador */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Alerta explicativo */}
          <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 p-3 text-xs text-blue-900 border border-blue-200">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="font-bold">Ambiente de Teste 100% Real</p>
              <p className="mt-0.5 text-blue-800">
                Esta simulação dispara os mesmos eventos de banco e WebSockets que a viagem real. Abra o portal do aluno (`/portal/acompanhar`) no celular ou em outra aba para ver as atualizações instantâneas!
              </p>
            </div>
          </div>

          {/* Seleção de Sentido */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <span className="text-xs font-bold text-slate-700">Sentido da Viagem:</span>
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setSentido("IDA")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${sentido === "IDA" ? "bg-white text-brand-800 shadow-xs" : "text-slate-600"}`}
              >
                Ida
              </button>
              <button
                type="button"
                onClick={() => setSentido("VOLTA")}
                className={`rounded-md px-3 py-1 text-xs font-semibold ${sentido === "VOLTA" ? "bg-white text-brand-800 shadow-xs" : "text-slate-600"}`}
              >
                Volta
              </button>
            </div>
          </div>

          {/* Status Box */}
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Status da Telemetria</span>
              <span className={`inline-flex items-center gap-1 font-bold ${rodando ? "text-emerald-400" : "text-amber-400"}`}>
                <span className={`h-2 w-2 rounded-full ${rodando ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                {rodando ? "Simulação em Andamento" : "Parado"}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{statusMsg}</p>
          </div>

          {/* Itinerário & Pontos */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Pontos do Percurso ({pontos.length})</h3>
            {carregando ? (
              <p className="text-xs text-slate-400">Carregando percurso…</p>
            ) : pontos.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-400">Nenhum ponto cadastrado para a {sentido.toLowerCase()} desta rota.</p>
            ) : (
              <div className="space-y-1.5">
                {pontos.map((p, idx) => {
                  const ehAtual = rodando && idx === pontoIdx;
                  const jaPassou = rodando && idx < pontoIdx;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                        ehAtual
                          ? "bg-brand-50 text-brand-900 font-bold ring-2 ring-brand-600"
                          : jaPassou
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                          {idx + 1}
                        </span>
                        <span>{p.nome}</span>
                      </div>
                      {ehAtual ? (
                        <span className="flex items-center gap-1 text-[11px] text-brand-700 font-extrabold">
                          <Bus className="h-3.5 w-3.5 animate-bounce" /> Ônibus no Ponto
                        </span>
                      ) : jaPassou ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                        </span>
                      ) : (
                        <span className="text-slate-400">Aguardando</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Passageiros da Simulação */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Passageiros na Viagem ({passageiros.length})</h3>
              <span className="text-xs font-semibold text-emerald-700">
                {passageiros.filter((p) => p.embarcado).length}/{passageiros.length} Embarcados
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {passageiros.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg p-2 text-xs border ${
                    p.embarcado
                      ? "bg-emerald-50 text-emerald-900 border-emerald-200 font-medium"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  <div className="truncate">
                    <p className="truncate font-semibold">{p.nome}</p>
                    <p className="text-[10px] text-slate-400 truncate">{p.faculdade || "Universitário"}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold">
                    {p.embarcado ? "✓ Embarcado" : "○ Fila"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer com Controles */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 p-4">
          <button
            type="button"
            onClick={limparDados}
            disabled={rodando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar Dados de Teste
          </button>

          <div className="flex gap-2">
            {rodando ? (
              <button
                type="button"
                onClick={pararSimulacao}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs"
              >
                <Square className="h-3.5 w-3.5" /> Pausar
              </button>
            ) : (
              <button
                type="button"
                onClick={iniciarSimulacao}
                disabled={pontos.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-xs font-bold text-white hover:bg-brand-800 shadow-xs disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Iniciar Percurso
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
