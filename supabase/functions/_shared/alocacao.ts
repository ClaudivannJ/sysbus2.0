/**
 * Engine de alocação de vagas do transporte universitário — FIFO por ordem de voto.
 *
 * Regra (a justa, "melhor que a enquete do WhatsApp"):
 *  - A vaga é de quem vota primeiro. Ordena TODAS as reservas por `ordem` (seq atômico
 *    da votação) e preenche os assentos dos ônibus ATIVOS na sequência.
 *  - Capacidade total = soma da capacidade dos ônibus ativos. Os primeiros N (N = capacidade
 *    total) ficam CONFIRMADOS; o restante fica em ESPERA (não viaja, só entra se alguém desistir).
 *  - O ponto de embarque NÃO decide a vaga (antes decidia, e isso era injusto: quem não era
 *    da localidade "dona" do ônibus ficava de fora mesmo votando antes). O ponto é só onde a
 *    pessoa embarca; a chamada é pela ordem dos confirmados.
 *  - Cancelamento: marca a reserva como CANCELADA e re-aloca; o próximo da espera sobe.
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

export function alocarViagem(
  reservas: ReservaInput[],
  onibus: OnibusInput[],
): ResultadoAlocacao {
  const ativos = reservas
    .filter((r) => r.status !== "CANCELADA")
    .sort((a, b) => a.ordem - b.ordem);

  // Frota em ordem estável (por nome). Preenche assentos na ordem de voto, sem olhar o ponto.
  const frota = [...onibus].sort((a, b) => a.nome.localeCompare(b.nome));
  const ocupacao = new Map<string, number>(frota.map((o) => [o.id, 0]));

  const alocacoes: AlocacaoReserva[] = [];
  let ponteiro = 0; // índice do ônibus atual a preencher

  for (const r of ativos) {
    // avança para o próximo ônibus com vaga
    while (ponteiro < frota.length && ocupacao.get(frota[ponteiro].id)! >= frota[ponteiro].capacidade) ponteiro++;
    const bus = ponteiro < frota.length ? frota[ponteiro] : null;

    if (bus) {
      const posicao = ocupacao.get(bus.id)! + 1;
      ocupacao.set(bus.id, posicao);
      alocacoes.push({
        reservaId: r.id, alunoId: r.alunoId, ordem: r.ordem,
        onibusId: bus.id, posicao, podeEscolher: [], status: "CONFIRMADA",
      });
    } else {
      alocacoes.push({
        reservaId: r.id, alunoId: r.alunoId, ordem: r.ordem,
        onibusId: null, posicao: null, podeEscolher: [], status: "ESPERA",
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