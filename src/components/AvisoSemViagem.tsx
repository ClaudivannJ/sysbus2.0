import { CalendarX, CalendarOff, Landmark } from "lucide-react";

export type MotivoSemViagem = "FORA_DE_OPERACAO" | "FERIADO" | "SEM_ENQUETE" | "SEM_ROTA" | "SEM_VIAGEM";

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
export function dataExtenso(iso: string) {
  // iso = "YYYY-MM-DD" (data pura, sem fuso) → formata sem deslocar o dia
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS_SEMANA[dt.getDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

// Aviso de que não há viagem hoje, explicando o motivo + próxima data.
// `contexto` só muda a redação (aluno vs. secretaria).
export default function AvisoSemViagem({
  motivo, proximaData, descricaoExcecao, horarioSaida, contexto = "aluno",
}: {
  motivo?: MotivoSemViagem;
  proximaData?: string | null;
  descricaoExcecao?: string | null;
  horarioSaida?: string | null;
  contexto?: "aluno" | "secretaria";
}) {
  const m = motivo ?? "SEM_VIAGEM";
  const prox = proximaData ? dataExtenso(proximaData) : null;
  const cfg = {
    FORA_DE_OPERACAO: { Icon: CalendarOff, titulo: "Hoje não há transporte nesta rota", texto: "Este não é um dia de operação configurado para a rota." },
    FERIADO: { Icon: Landmark, titulo: "Sem transporte hoje (feriado / recesso)", texto: descricaoExcecao ? `Motivo: ${descricaoExcecao}.` : "O calendário marca hoje como feriado ou recesso." },
    SEM_ENQUETE: { Icon: CalendarX, titulo: "Rota sem votação configurada", texto: contexto === "secretaria" ? "Defina os horários de abertura/fechamento da votação nesta rota." : "A secretaria ainda não definiu os horários de votação desta rota." },
    SEM_ROTA: { Icon: CalendarX, titulo: contexto === "secretaria" ? "Rota não encontrada" : "Você ainda não tem uma rota", texto: contexto === "secretaria" ? "Selecione uma rota válida." : "Defina sua cidade/rota no Perfil para participar da viagem." },
    SEM_VIAGEM: { Icon: CalendarX, titulo: "Não há viagem programada para hoje", texto: "Volte no próximo dia de operação da rota." },
  }[m];
  const { Icon, titulo, texto } = cfg;
  return (
    <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100"><Icon className="h-6 w-6 text-slate-500" /></div>
      <p className="text-base font-semibold text-slate-800">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{texto}</p>
      {prox && (
        <p className="mt-3 inline-block rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
          Próxima viagem: <strong>{prox}</strong>{horarioSaida ? ` · saída ${horarioSaida}` : ""}
        </p>
      )}
    </div>
  );
}
