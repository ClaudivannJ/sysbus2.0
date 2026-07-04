// Datas/horas ancoradas no fuso de Pernambuco (UTC-3, sem horário de verão).
// Evita bugs quando o servidor roda em UTC (nuvem): construímos os instantes
// explicitamente em -03:00 em vez de depender do fuso da máquina.

const TZ = "-03:00";
const ZONA = "America/Recife";

const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** Componentes ano/mês/dia de uma data, no fuso de Pernambuco. */
function ymdBRT(d = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return { ano: Number(p.year), mes: Number(p.month), dia: Number(p.day) };
}

/** Instante absoluto correspondente a uma data/hora local de Pernambuco. */
function instanteBRT(
  ano: number,
  mes: number,
  dia: number,
  h = 0,
  min = 0,
  s = 0,
  ms = 0,
) {
  return new Date(
    `${ano}-${pad(mes)}-${pad(dia)}T${pad(h)}:${pad(min)}:${pad(s)}.${pad(ms, 3)}${TZ}`,
  );
}

export function inicioDeHoje() {
  const { ano, mes, dia } = ymdBRT();
  return instanteBRT(ano, mes, dia, 0, 0);
}

export function amanha() {
  return new Date(inicioDeHoje().getTime() + 24 * 60 * 60 * 1000);
}

/** Dia da semana de HOJE (Pernambuco) no padrão ISO (1=seg ... 7=dom). */
export function diaSemanaHojeISO(): number {
  const { ano, mes, dia } = ymdBRT();
  const d = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); // 0=dom ... 6=sáb
  return d === 0 ? 7 : d;
}

/** Data de HOJE (Pernambuco) como instante UTC-meia-noite — p/ colunas @db.Date. */
export function dataHojeUTC(): Date {
  const { ano, mes, dia } = ymdBRT();
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/** Hoje, em determinado horário local de Pernambuco (ex.: abertura 08:30). */
export function horarioDeHoje(h: number, min = 0) {
  const { ano, mes, dia } = ymdBRT();
  return instanteBRT(ano, mes, dia, h, min);
}

/** Converte "HH:MM" para o instante de HOJE nesse horário (Pernambuco). */
export function horaParaHoje(hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const { ano, mes, dia } = ymdBRT();
  return instanteBRT(ano, mes, dia, h, min);
}

/** Formata um instante como "HH:MM" no fuso de Pernambuco (para inputs). */
export function horaBRT(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleTimeString("pt-BR", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function semestreAtual(d = new Date()): string {
  const { ano, mes } = ymdBRT(d);
  return `${ano}.${mes <= 6 ? 1 : 2}`;
}

/** Validade = FIM do último dia do semestre (23:59:59), no fuso de Pernambuco. */
export function fimDoSemestre(d = new Date()): Date {
  const { ano, mes } = ymdBRT(d);
  return mes <= 6
    ? instanteBRT(ano, 7, 31, 23, 59, 59, 999)
    : instanteBRT(ano, 12, 31, 23, 59, 59, 999);
}

export function fimDoSemestreDeLabel(semestre: string): Date {
  const [a, s] = semestre.split(".");
  const ano = Number(a);
  return s === "1"
    ? instanteBRT(ano, 7, 31, 23, 59, 59, 999)
    : instanteBRT(ano, 12, 31, 23, 59, 59, 999);
}

/** É hoje o aniversário? Compara dia/mês no fuso de Pernambuco. */
export function ehAniversarioHoje(nascimento: Date): boolean {
  const hoje = ymdBRT();
  const nasc = ymdBRT(nascimento);
  return hoje.dia === nasc.dia && hoje.mes === nasc.mes;
}
