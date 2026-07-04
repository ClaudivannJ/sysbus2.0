// Resolução da viagem do dia a partir do CALENDÁRIO configurado pela secretaria
// (dias de operação + horários da enquete + exceções). Compartilhado entre a enquete
// (portal do aluno) e o transporte (painel da secretaria) para que a viagem seja
// materializada de forma consistente por qualquer acesso — e para explicar, quando não
// há viagem, o MOTIVO (fim de semana, feriado, rota sem votação) + a próxima data útil.

import { inicioDeHoje, amanha, dataHojeUTC, diaSemanaHojeISO, horaParaHoje } from "./tempo.ts";

// deno-lint-ignore no-explicit-any
type DB = any;

export type MotivoSemViagem = "FORA_DE_OPERACAO" | "FERIADO" | "SEM_ENQUETE" | "SEM_ROTA";
export interface ResViagem {
  id: string | null;
  motivo?: MotivoSemViagem;
  proxima?: string | null;      // "YYYY-MM-DD" do próximo dia de operação
  descricao?: string | null;    // descrição da exceção (feriado/recesso)
  horario?: string | null;      // horário de saída configurado
}

export async function viagemDeHoje(db: DB, destinoId: string): Promise<string | null> {
  const { data } = await db.from("Viagem").select("id").eq("destinoId", destinoId)
    .gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString()).limit(1).maybeSingle();
  return data?.id ?? null;
}

// Próximo dia de operação (dias da semana da rota, pulando exceções).
async function proximaData(db: DB, destino: DB): Promise<string | null> {
  const dias: number[] = Array.isArray(destino.diasSemana) ? destino.diasSemana : [];
  if (!dias.length) return null;
  const base = dataHojeUTC();
  const { data: excs } = await db.from("ExcecaoCalendario").select("data")
    .gte("data", new Date(base.getTime() + 86400000).toISOString())
    .lt("data", new Date(base.getTime() + 22 * 86400000).toISOString())
    .or(`destinoId.eq.${destino.id},destinoId.is.null`);
  const excSet = new Set((excs ?? []).map((e: DB) => new Date(e.data).toISOString().slice(0, 10)));
  const hojeDow = diaSemanaHojeISO();
  for (let i = 1; i <= 21; i++) {
    const dow = ((hojeDow - 1 + i) % 7) + 1; // avança dias mantendo o dia-da-semana correto
    if (!dias.includes(dow)) continue;
    const iso = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (!excSet.has(iso)) return iso;
  }
  return null;
}

// Materializa a viagem de hoje respeitando o calendário. Cria a linha se hoje é dia de
// operação (assim a enquete "existe" no horário, sem depender de ninguém acessar). Se não
// há viagem, devolve o MOTIVO + próxima data.
export async function resolverViagem(db: DB, destinoId: string): Promise<ResViagem> {
  const existente = await viagemDeHoje(db, destinoId);
  if (existente) return { id: existente };

  const { data: destino } = await db.from("Destino")
    .select("id, horarioSaida, enqueteAbre, enqueteFecha, intervaloChamadaS, diasSemana").eq("id", destinoId).maybeSingle();
  if (!destino) return { id: null, motivo: "SEM_ROTA" };

  const opera = Array.isArray(destino.diasSemana) && destino.diasSemana.includes(diaSemanaHojeISO());
  const inicioDia = dataHojeUTC();
  const { data: exc } = await db.from("ExcecaoCalendario").select("descricao, tipo")
    .gte("data", inicioDia.toISOString()).lt("data", new Date(inicioDia.getTime() + 86400000).toISOString())
    .or(`destinoId.eq.${destinoId},destinoId.is.null`).limit(1).maybeSingle();
  const prox = await proximaData(db, destino);

  if (!opera) return { id: null, motivo: "FORA_DE_OPERACAO", proxima: prox, horario: destino.horarioSaida };
  if (exc) return { id: null, motivo: "FERIADO", descricao: exc.descricao ?? null, proxima: prox, horario: destino.horarioSaida };
  if (!destino.enqueteAbre && !destino.enqueteFecha) return { id: null, motivo: "SEM_ENQUETE" };

  const novoId = crypto.randomUUID();
  const { error } = await db.from("Viagem").insert({
    id: novoId, destinoId, data: inicioDeHoje().toISOString(), horario: destino.horarioSaida,
    abreEm: destino.enqueteAbre ? horaParaHoje(destino.enqueteAbre)?.toISOString() : null,
    fechaEm: destino.enqueteFecha ? horaParaHoje(destino.enqueteFecha)?.toISOString() : null,
    intervaloChamadaS: destino.intervaloChamadaS, status: "ABERTA",
  });
  if (error) return { id: await viagemDeHoje(db, destinoId) }; // corrida: já criada
  return { id: novoId };
}
