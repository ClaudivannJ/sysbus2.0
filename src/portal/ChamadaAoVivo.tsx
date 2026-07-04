import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";

export interface ItemChamada {
  reservaId: string; nome: string; fotoUrl: string | null; onibusNome: string | null; posicao: number | null;
}
export interface PontoChamada {
  localidadeId: string; ponto: string; chamadaEmISO: string | null; ordem: ItemChamada[];
}

function iniciais(nome: string) {
  return nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
function Foto({ item, grande }: { item: ItemChamada; grande?: boolean }) {
  const cls = grande ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs";
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700`}>
      {item.fotoUrl ? <img src={item.fotoUrl} alt={item.nome} className="h-full w-full object-cover" /> : iniciais(item.nome)}
    </div>
  );
}
function relogio(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" });
}

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{children}</div>
);

function PontoView({ ponto, intervaloMs, intervaloSegundos, agora, meuReservaId }: {
  ponto: PontoChamada; intervaloMs: number; intervaloSegundos: number; agora: number; meuReservaId?: string | null;
}) {
  const inicio = ponto.chamadaEmISO ? new Date(ponto.chamadaEmISO).getTime() : null;
  const total = ponto.ordem.length;
  const cabecalho = (
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
      <Megaphone className="h-4 w-4 text-brand-600" />
      <span className="text-sm font-semibold text-slate-700">{ponto.ponto}</span>
      <span className="ml-auto text-xs text-slate-400">{total} confirmado(s)</span>
    </div>
  );
  if (!inicio) return <Card>{cabecalho}<p className="px-4 py-3 text-xs text-slate-400">Chamada não programada.</p></Card>;
  if (agora < inicio) return (
    <Card>{cabecalho}<p className="px-4 py-3 text-sm text-slate-500">Começa às <b>{hhmm(ponto.chamadaEmISO!)}</b> — faltam <b>{relogio(inicio - agora)}</b></p></Card>
  );
  const idx = Math.floor((agora - inicio) / intervaloMs);
  if (idx >= total) return <Card>{cabecalho}<p className="px-4 py-3 text-sm text-slate-600">Chamada encerrada — {total} chamado(s).</p></Card>;

  const atual = ponto.ordem[idx];
  const proximos = ponto.ordem.slice(idx + 1, idx + 4);
  const restanteMs = inicio + (idx + 1) * intervaloMs - agora;
  const souEu = meuReservaId && atual.reservaId === meuReservaId;

  return (
    <Card>
      {cabecalho}
      <div className={`flex items-center gap-4 px-4 py-4 ${souEu ? "bg-emerald-50" : "bg-brand-50/60"}`}>
        <Foto item={atual} grande />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-medium uppercase tracking-wide ${souEu ? "text-emerald-700" : "text-brand-600"}`}>
            {souEu ? "É a sua vez!" : "Chamando agora"} · {idx + 1} de {total}
          </p>
          <p className="truncate text-xl font-bold text-slate-900">{atual.nome}</p>
          <p className="text-sm text-slate-500">{atual.onibusNome ?? "—"}{atual.posicao ? ` · ${atual.posicao}º` : ""}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold tabular-nums text-brand-700">{relogio(restanteMs)}</p>
          <p className="text-[11px] text-slate-400">próximo</p>
        </div>
      </div>
      {proximos.length > 0 && (
        <div className="px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-400">A seguir (1 a cada {intervaloSegundos}s)</p>
          <ul className="space-y-2">
            {proximos.map((p, k) => (
              <li key={p.reservaId} className="flex items-center gap-3">
                <Foto item={p} />
                <span className="text-sm text-slate-700">{p.nome}</span>
                <span className="ml-auto text-xs text-slate-400">{idx + 2 + k}º</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function ChamadaAoVivo({ intervaloSegundos, pontos, meuReservaId }: {
  intervaloSegundos: number; pontos: PontoChamada[]; meuReservaId?: string | null;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (pontos.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <Megaphone className="h-5 w-5 text-slate-300" />
        Nenhum confirmado ainda — a chamada aparece por ponto de embarque.
      </div>
    );
  }
  const intervaloMs = intervaloSegundos * 1000;
  return (
    <div className="space-y-3">
      {pontos.map((p) => (
        <PontoView key={p.localidadeId} ponto={p} intervaloMs={intervaloMs} intervaloSegundos={intervaloSegundos} agora={agora} meuReservaId={meuReservaId} />
      ))}
    </div>
  );
}
