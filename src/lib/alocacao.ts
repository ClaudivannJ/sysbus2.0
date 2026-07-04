/**
 * Engine de alocação de vagas do transporte universitário.
 *
 * Regras (rota Arcoverde, como exemplo real):
 *  - Cada ônibus tem capacidade e atende um conjunto de localidades com uma
 *    prioridade. prioridade 1 = ônibus "dono" daquela localidade; 2+ = transbordo.
 *      ex.: Ônibus Itaiba -> { Itaiba: 1 }
 *           Ônibus NEG    -> { Negras: 1, Estrada: 1, Giral: 1, Itaiba: 2 }
 *  - A fila é ordenada por `ordem` (ordem de entrada / chamada das 17h).
 *  - Cada aluno é alocado no ônibus de MAIOR prioridade para a sua localidade
 *    que ainda tenha vaga. Se nenhum candidato tem vaga -> lista de espera.
 *  - Itaiba lota -> excedente transborda pro NEG (prioridade 2) se houver vaga.
 *  - Cancelamento: basta marcar a reserva como CANCELADA e re-alocar; a cascata
 *    (próximo da fila sobe) acontece naturalmente.
 *  - Escolha de ônibus: quando a localidade do aluno tem mais de um ônibus com
 *    vaga, ele PODE escolher (campo `onibusPreferidoId`). `podeEscolher` lista
 *    as alternativas para a UI oferecer.
 *
 * Função pura, sem dependência de banco — fácil de testar e auditar.
 */

export interface OnibusInput {
  id: string;
  nome: string;
  capacidade: number;
  /** localidadeId -> prioridade (menor = mais prioritário) */
  prioridades: Record<string, number>;
}

export interface ReservaInput {
  id: string;
  alunoId: string;
  localidadeId: string;
  /** ordem na fila (1 = primeiro). Empates resolvidos por este valor. */
  ordem: number;
  /** ônibus escolhido manualmente pelo aluno, quando houve opção */
  onibusPreferidoId?: string | null;
  status: "CONFIRMADA" | "ESPERA" | "CANCELADA";
}

export interface AlocacaoReserva {
  reservaId: string;
  alunoId: string;
  ordem: number;
  /** ônibus alocado; null = lista de espera */
  onibusId: string | null;
  /** posição dentro do ônibus (1..capacidade); null se em espera */
  posicao: number | null;
  /** outros ônibus que atendem a localidade e tinham vaga no momento da alocação */
  podeEscolher: string[];
  status: "CONFIRMADA" | "ESPERA";
}

export interface ResultadoAlocacao {
  /** alocações na ordem da fila */
  alocacoes: AlocacaoReserva[];
  /** agrupado por ônibus, na ordem de embarque (posição) */
  porOnibus: Record<string, AlocacaoReserva[]>;
  /** quem ficou de fora */
  espera: AlocacaoReserva[];
}

/** Candidatos de ônibus para uma localidade, ordenados por prioridade asc. */
function candidatosPara(localidadeId: string, onibus: OnibusInput[]): OnibusInput[] {
  return onibus
    .filter((o) => localidadeId in o.prioridades)
    .sort((a, b) => a.prioridades[localidadeId] - b.prioridades[localidadeId]);
}

export function alocarViagem(
  reservas: ReservaInput[],
  onibus: OnibusInput[],
): ResultadoAlocacao {
  const ativos = reservas
    .filter((r) => r.status !== "CANCELADA")
    .sort((a, b) => a.ordem - b.ordem);

  const ocupacao = new Map<string, number>();
  for (const o of onibus) ocupacao.set(o.id, 0);

  const alocacoes: AlocacaoReserva[] = [];

  for (const r of ativos) {
    const candidatos = candidatosPara(r.localidadeId, onibus);
    const comVaga = candidatos.filter((o) => ocupacao.get(o.id)! < o.capacidade);

    // Respeita a preferência do aluno, se o ônibus preferido ainda tem vaga.
    let escolhido = comVaga.find((o) => o.id === r.onibusPreferidoId) ?? comVaga[0];

    if (escolhido) {
      const novaOcupacao = ocupacao.get(escolhido.id)! + 1;
      ocupacao.set(escolhido.id, novaOcupacao);
      alocacoes.push({
        reservaId: r.id,
        alunoId: r.alunoId,
        ordem: r.ordem,
        onibusId: escolhido.id,
        posicao: novaOcupacao,
        podeEscolher: comVaga.filter((o) => o.id !== escolhido!.id).map((o) => o.id),
        status: "CONFIRMADA",
      });
    } else {
      alocacoes.push({
        reservaId: r.id,
        alunoId: r.alunoId,
        ordem: r.ordem,
        onibusId: null,
        posicao: null,
        podeEscolher: [],
        status: "ESPERA",
      });
    }
  }

  const porOnibus: Record<string, AlocacaoReserva[]> = {};
  for (const o of onibus) porOnibus[o.id] = [];
  const espera: AlocacaoReserva[] = [];
  for (const a of alocacoes) {
    if (a.onibusId) porOnibus[a.onibusId].push(a);
    else espera.push(a);
  }

  return { alocacoes, porOnibus, espera };
}