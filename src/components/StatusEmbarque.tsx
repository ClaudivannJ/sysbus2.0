import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bus, Users, Clock, UserX, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";

interface AusenteInfo {
  nome: string;
  fotoUrl?: string | null;
}

interface StatusOnibus {
  onibusId: string;
  onibusNome: string;
  capacidade: number;
  embarcados: number;
  aguardando: number;
  politica: "PRIVADO" | "CONTAGEM" | "CONTAGEM_NOMES" | "PERFIL_COMPLETO";
  ausentes: AusenteInfo[];
}

interface StatusRota {
  ativo: boolean;
  rota?: string;
  sentido?: "IDA" | "VOLTA";
  pontoAtualId?: string | null;
  onibus?: StatusOnibus[];
}

function iniciais(nome: string) {
  return nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function AvatarAusente({ ausente }: { ausente: AusenteInfo }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-xs font-bold text-amber-700 ring-2 ring-amber-300">
        {ausente.fotoUrl
          ? <img src={ausente.fotoUrl} alt={ausente.nome} className="h-full w-full object-cover" />
          : iniciais(ausente.nome)}
      </div>
      <p className="max-w-[52px] truncate text-center text-[10px] text-slate-500">{ausente.nome.split(" ")[0]}</p>
    </div>
  );
}

function CardOnibus({ oni }: { oni: StatusOnibus }) {
  const [expandido, setExpandido] = useState(false);
  const progresso = oni.capacidade > 0 ? Math.round((oni.embarcados / oni.capacidade) * 100) : 0;
  const tudo = oni.aguardando === 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tudo ? "bg-emerald-100" : "bg-brand-100"}`}>
          <Bus className={`h-5 w-5 ${tudo ? "text-emerald-600" : "text-brand-700"}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{oni.onibusNome}</p>
          <p className="text-xs text-slate-500">
            {tudo
              ? "Todos embarcados — pronto para partir"
              : `${oni.aguardando} passageiro${oni.aguardando !== 1 ? "s" : ""} aguardando`}
          </p>
        </div>
        {tudo
          ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          : <UserX className="h-5 w-5 shrink-0 text-amber-500" />}
      </div>

      {/* Barra de progresso */}
      <div className="px-4 pb-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {oni.embarcados} / {oni.capacidade} embarcados</span>
          <span>{progresso}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tudo ? "bg-emerald-500" : "bg-brand-600"}`}
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* Ausentes — conforme política */}
      {!tudo && oni.politica !== "PRIVADO" && (
        <div className="border-t border-slate-100 px-4 py-3">
          {oni.politica === "CONTAGEM" ? (
            <p className="text-xs text-slate-500">
              Aguardando {oni.aguardando} passageiro{oni.aguardando !== 1 ? "s" : ""}.
            </p>
          ) : oni.ausentes.length > 0 && (
            <>
              <p className="mb-2 text-[11px] font-medium text-slate-400">Ainda não embarcaram:</p>
              {oni.politica === "PERFIL_COMPLETO" ? (
                <div className="flex flex-wrap gap-2">
                  {(expandido ? oni.ausentes : oni.ausentes.slice(0, 5)).map((a, i) => (
                    <AvatarAusente key={i} ausente={a} />
                  ))}
                  {!expandido && oni.ausentes.length > 5 && (
                    <button onClick={() => setExpandido(true)}
                      className="flex flex-col items-center gap-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                        +{oni.ausentes.length - 5}
                      </div>
                    </button>
                  )}
                </div>
              ) : (
                // CONTAGEM_NOMES — lista simples
                <ul className="space-y-1">
                  {oni.ausentes.map((a, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                      {a.nome}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StatusEmbarque({ destinoId }: { destinoId: string | null | undefined }) {
  const [agora, setAgora] = useState(Date.now());

  // Atualiza o timestamp a cada 15s para forçar refetch
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery<StatusRota>({
    queryKey: ["status-embarque", destinoId, Math.floor(agora / 15_000)],
    enabled: Boolean(destinoId),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("status-rota", {
        body: { destinoId },
      });
      if (error) throw error;
      return data as StatusRota;
    },
  });

  if (!destinoId || isLoading || !data) return null;
  if (!data.ativo) return null;

  const onibus = data.onibus ?? [];
  const totalEmbarcados = onibus.reduce((s, o) => s + o.embarcados, 0);
  const totalCapacidade = onibus.reduce((s, o) => s + o.capacidade, 0);
  const totalAguardando = onibus.reduce((s, o) => s + o.aguardando, 0);
  const tudoPronto = totalAguardando === 0;

  return (
    <div className="space-y-3">
      {/* Banner de status geral */}
      <div className={`flex flex-col gap-2 rounded-xl p-4 ${tudoPronto ? "bg-emerald-600" : "bg-brand-900"} text-white shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
              Sua viagem hoje · {data.sentido === "IDA" ? "Ida" : "Volta"}
            </p>
            <p className="text-base font-bold truncate">{data.rota}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums">{totalEmbarcados}<span className="text-sm font-normal opacity-70">/{totalCapacidade}</span></p>
            <p className="flex items-center justify-end gap-1 text-[11px] opacity-70"><Clock className="h-3 w-3" /> ao vivo</p>
          </div>
        </div>

        <Link
          to="/portal/acompanhar"
          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25 transition-colors"
        >
          Acompanhar Viagem ao Vivo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Card por ônibus */}
      {onibus.map((oni) => <CardOnibus key={oni.onibusId} oni={oni} />)}
    </div>
  );
}
