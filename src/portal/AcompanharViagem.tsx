import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, Bus, CheckCircle2, Clock, MapPin, Navigation, UserCheck, Users, Info } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useAluno } from "./useAluno";
import { useCanal } from "./useCanal";

interface PassageiroFeed {
  reservaId: string;
  alunoId: string;
  nome: string;
  fotoUrl: string | null;
  faculdade: string | null;
  localidadeNome: string | null;
  status: "EMBARCADO" | "AGUARDANDO";
  horarioEmbarque?: string | null;
}

interface PontoTimeline {
  id: string;
  ordem: number;
  nome: string;
  totalEsperados: number;
  embarcados: number;
  atual: boolean;
  passageiros: PassageiroFeed[];
}

interface EstadoViagemAoVivo {
  ativo: boolean;
  viagemId?: string;
  destinoId?: string;
  rotaNome?: string;
  sentido?: "IDA" | "VOLTA";
  pontoAtualId?: string | null;
  pontoAtualNome?: string | null;
  proximoPontoNome?: string | null;
  emDeslocamento?: boolean;
  capacidadeTotal?: number;
  totalEmbarcados?: number;
  pontos: PontoTimeline[];
  politica?: string;
}

function iniciais(nome: string) {
  return nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function AcompanharViagem() {
  const { perfil } = useAuth();
  const { data: aluno } = useAluno(perfil?.id);
  const destinoId = aluno?.destino?.id ?? null;
  const [agora, setAgora] = useState(() => Date.now());

  // 1. Invalida cache instantaneamente quando chega evento Realtime no canal do monitor
  const realtimeAtivo = useCanal(`monitor-viagem:${destinoId}`, () => {
    setAgora(Date.now());
  });

  // Polling leve a cada 4 segundos como fallback resiliente
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 4_000);
    return () => clearInterval(t);
  }, []);

  const { data: estado, isLoading } = useQuery<EstadoViagemAoVivo>({
    queryKey: ["acompanhar-viagem-ao-vivo", destinoId, Math.floor(agora / 3_000)],
    enabled: Boolean(destinoId),
    queryFn: async () => {
      // Busca estado completo da viagem de hoje
      const inicio = new Date();
      inicio.setHours(0, 0, 0, 0);
      const amanha = new Date(inicio);
      amanha.setDate(amanha.getDate() + 1);

      const { data: v } = await supabase
        .from("Viagem")
        .select(`
          id, horario, pontoAtualId, sentidoAtual,
          destino:Destino ( id, nome, transparenciaEmbarque ),
          reservas:Reserva (
            id, alunoId, seq, status, vaiIda, vaiVolta, onibusId,
            aluno:Aluno ( nome, fotoUrl, faculdade, localidadeId, localidade:Localidade(nome) ),
            embarques:Embarque ( sentido, horario )
          )
        `)
        .eq("destinoId", destinoId!)
        .gte("data", inicio.toISOString())
        .lt("data", amanha.toISOString())
        .limit(1)
        .maybeSingle();

      if (!v) return { ativo: false };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vObj = v as any;
      const sentido = (vObj.sentidoAtual as "IDA" | "VOLTA") ?? "IDA";

      // Pontos do itinerário
      const { data: pontosRaw } = await supabase
        .from("PontoRota")
        .select("id, sentido, ordem, nome, localidadeId, faculdade")
        .eq("destinoId", destinoId!)
        .order("ordem");

      const itinSentido = (pontosRaw ?? []).filter((p) => p.sentido === sentido).sort((a, b) => a.ordem - b.ordem);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reservasConf = (vObj.reservas ?? []).filter((r: any) => r.status === "CONFIRMADA");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const temEmb = (r: any) => (r.embarques ?? []).find((e: any) => e.sentido === sentido);

      let pontoAtualNome: string | null = null;
      let proximoPontoNome: string | null = null;

      const idxAtual = itinSentido.findIndex((p) => p.id === vObj.pontoAtualId);
      if (idxAtual >= 0) {
        pontoAtualNome = itinSentido[idxAtual].nome;
        // Encontra o próximo ponto que tenha passageiros esperados
        for (let i = idxAtual + 1; i < itinSentido.length; i++) {
          proximoPontoNome = itinSentido[i].nome;
          break;
        }
      }

      const pontosTimeline: PontoTimeline[] = itinSentido.map((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let passageirosRaw: any[] = [];
        if (sentido === "IDA" && p.localidadeId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          passageirosRaw = reservasConf.filter((r: any) => r.vaiIda && r.aluno?.localidadeId === p.localidadeId);
        } else if (sentido === "VOLTA" && p.faculdade) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          passageirosRaw = reservasConf.filter((r: any) => r.vaiVolta && r.aluno?.faculdade === p.faculdade && (r.embarques ?? []).some((e: any) => e.sentido === "IDA"));
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const passageiros: PassageiroFeed[] = passageirosRaw.map((r: any) => {
          const emb = temEmb(r);
          return {
            reservaId: r.id,
            alunoId: r.alunoId,
            nome: r.aluno?.nome ?? "Passageiro",
            fotoUrl: r.aluno?.fotoUrl ?? null,
            faculdade: r.aluno?.faculdade ?? null,
            localidadeNome: r.aluno?.localidade?.nome ?? null,
            status: emb ? "EMBARCADO" : "AGUARDANDO",
            horarioEmbarque: emb?.horario ? new Date(emb.horario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null,
          };
        });

        const embarcados = passageiros.filter((p) => p.status === "EMBARCADO").length;

        return {
          id: p.id,
          ordem: p.ordem,
          nome: p.nome,
          totalEsperados: passageiros.length,
          embarcados,
          atual: p.id === vObj.pontoAtualId,
          passageiros,
        };
      });

      const totalEmbarcados = pontosTimeline.reduce((s, p) => s + p.embarcados, 0);
      const capacidadeTotal = pontosTimeline.reduce((s, p) => s + p.totalEsperados, 0);

      return {
        ativo: true,
        viagemId: vObj.id,
        destinoId,
        rotaNome: vObj.destino?.nome ?? "Transporte",
        sentido,
        pontoAtualId: vObj.pontoAtualId ?? null,
        pontoAtualNome,
        proximoPontoNome,
        emDeslocamento: Boolean(vObj.pontoAtualId) && !pontosTimeline.find((p) => p.atual && p.embarcados < p.totalEsperados),
        capacidadeTotal,
        totalEmbarcados,
        pontos: pontosTimeline,
        politica: vObj.destino?.transparenciaEmbarque ?? "CONTAGEM_NOMES",
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-slate-400">
        <Bus className="h-8 w-8 animate-bounce text-brand-600" />
        <p className="text-sm font-medium">Carregando telemetria da rota…</p>
      </div>
    );
  }

  if (!estado?.ativo) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <Link to="/portal" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Voltar para o portal
        </Link>
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <Bus className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-3 text-base font-bold text-slate-800">Nenhuma viagem ativa agora</h2>
          <p className="mt-1 text-xs text-slate-500">O acompanhamento em tempo real estará disponível quando o ônibus iniciar a viagem de hoje.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-20">
      {/* Voltar */}
      <div className="flex items-center justify-between">
        <Link to="/portal" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-brand-800">
          <ArrowLeft className="h-4 w-4" /> Acompanhar Viagem
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          {realtimeAtivo ? "Ao vivo (Realtime)" : "Conectado"}
        </span>
      </div>

      {/* Banner Principal de Status */}
      <div className="rounded-2xl bg-brand-900 p-5 text-white shadow-md">
        <div className="flex items-center justify-between text-xs font-medium text-brand-200">
          <span>{estado.rotaNome} · {estado.sentido === "IDA" ? "Ida" : "Volta"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Atualizando em tempo real</span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div>
            {estado.pontoAtualNome ? (
              <>
                <p className="text-xs uppercase tracking-wider text-brand-300 font-semibold">Localização do Ônibus</p>
                <p className="text-lg font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-5 w-5 text-amber-400 shrink-0" />
                  {estado.pontoAtualNome}
                </p>
              </>
            ) : (
              <p className="text-base font-bold text-white flex items-center gap-2">
                <Navigation className="h-5 w-5 text-emerald-400 animate-pulse" />
                Ônibus em deslocamento na rota
              </p>
            )}
          </div>
          <div className="text-right bg-white/10 px-3 py-2 rounded-xl border border-white/15">
            <p className="text-xl font-black text-white tabular-nums">{estado.totalEmbarcados}<span className="text-xs font-normal text-brand-200">/{estado.capacidadeTotal}</span></p>
            <p className="text-[10px] font-semibold text-brand-300 uppercase">Embarcados</p>
          </div>
        </div>

        {/* Status descritivo inteligente */}
        {estado.proximoPontoNome && (
          <div className="mt-3 border-t border-white/10 pt-2.5 text-xs text-brand-100 flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Próximo ponto: <strong>{estado.proximoPontoNome}</strong></span>
          </div>
        )}
      </div>

      {/* Linha do Tempo dos Pontos (Itinerário Stepper) */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">Percurso & Embarques em Tempo Real</h3>

        {estado.pontos.map((ponto, idx) => {
          const concluido = ponto.totalEsperados > 0 && ponto.embarcados === ponto.totalEsperados;
          const semPassageiros = ponto.totalEsperados === 0;

          return (
            <div key={ponto.id} className={`rounded-xl border bg-white p-4 shadow-sm transition-all ${ponto.atual ? "ring-2 ring-brand-600 border-brand-300" : "border-slate-200"}`}>
              {/* Cabeçalho do Ponto */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${concluido ? "bg-emerald-100 text-emerald-700" : ponto.atual ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      {ponto.nome}
                      {ponto.atual && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">Ponto Atual</span>}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {semPassageiros
                        ? "Sem embarques previstos neste ponto"
                        : `${ponto.embarcados} de ${ponto.totalEsperados} embarcados`}
                    </p>
                  </div>
                </div>

                {semPassageiros ? (
                  <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Info className="h-4 w-4" /> Sem paradas
                  </span>
                ) : concluido ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Liberado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full ring-1 ring-amber-200">
                    <Users className="h-3.5 w-3.5" /> Faltam {ponto.totalEsperados - ponto.embarcados}
                  </span>
                )}
              </div>

              {/* Feed de Alunos (Muda de Amarelo para VERDE instantaneamente via Realtime) */}
              {!semPassageiros && estado.politica !== "PRIVADO" && ponto.passageiros.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Passageiros deste ponto:</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {ponto.passageiros.map((pass) => {
                      const embarcado = pass.status === "EMBARCADO";
                      return (
                        <div
                          key={pass.reservaId}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-300 ${
                            embarcado
                              ? "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-300"
                              : "bg-amber-50/70 text-amber-950 ring-1 ring-amber-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-xs ${embarcado ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800"}`}>
                              {pass.fotoUrl ? (
                                <img src={pass.fotoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                iniciais(pass.nome)
                              )}
                            </div>
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="truncate text-xs font-bold">{pass.nome}</p>
                              <p className="text-[10px] text-slate-500 truncate">{pass.faculdade || pass.localidadeNome || "Universitário"}</p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right ml-2">
                            {embarcado ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                <UserCheck className="h-3.5 w-3.5" /> {pass.horarioEmbarque ?? "OK"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" /> Aguardando
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
