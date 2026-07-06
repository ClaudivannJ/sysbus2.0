/**
 * Engine de alocação de vagas do transporte universitário — FIFO por ordem de voto,
 * com preferência de ônibus por localidade de embarque.
 *
 * Regras:
 *  1. A vaga é de quem vota primeiro (ordem global por seq atômico).
 *  2. Cada pessoa tenta o ônibus PREFERENCIAL da sua localidade primeiro
 *     (menor valor de prioridade em OnibusLocalidade = mais preferido).
 *  3. Se o preferencial estiver cheio → entra no próximo ônibus com vaga,
 *     MANTENDO a posição global da fila (não vai para o fim).
 *     Esse caso é marcado como `transbordo = true`.
 *  4. `posicao` = assento global no ônibus (1..capacidade), útil para 1 único ônibus.
 *  5. `posicaoLocalidade` = rank dentro do grupo (mesma localidade + mesmo ônibus),
 *     sempre sequencial 1, 2, 3… sem gaps — exibido quando há múltiplos ônibus.
 *
 * Função pura, sem dependência de banco — fácil de testar e auditar.
 */

export interface OnibusInput {
  id: string;
  nome: string;
  capacidade: number;
  /** localidadeId → prioridade (menor = mais prioritário para essa localidade) */
  prioridades: Record<string, number>;
}

export interface ReservaInput {
  id: string;
  alunoId: string;
  localidadeId: string;
  /** ordem na fila (1 = primeiro). Determinada pelo seq atômico da votação. */
  ordem: number;
  /** ônibus escolhido manualmente pelo aluno, quando houve opção */
  onibusPreferidoId?: string | null;
  status: "CONFIRMADA" | "ESPERA" | "CANCELADA";
}

export interface AlocacaoReserva {
  reservaId: string;
  alunoId: string;
  /** localidade de embarque da pessoa */
  localidadeId: string;
  /** posição global na fila de votação */
  ordem: number;
  /** ônibus alocado; null = lista de espera */
  onibusId: string | null;
  /** assento global no ônibus (1..capacidade); null se em espera */
  posicao: number | null;
  /**
   * Rank dentro do grupo (mesma localidade + mesmo ônibus), sempre 1, 2, 3…
   * Usar quando há múltiplos ônibus ativos. null se em espera.
   */
  posicaoLocalidade: number | null;
  /** true quando foi alocado em ônibus diferente do preferencial (overflowed) */
  transbordo: boolean;
  /** outros ônibus que atendem a localidade e tinham vaga no momento da alocação */
  podeEscolher: string[];
  status: "CONFIRMADA" | "ESPERA";
}

export interface ResultadoAlocacao {
  /** alocações na ordem da fila global */
  alocacoes: AlocacaoReserva[];
  /** agrupado por ônibus, na ordem de embarque (posição) */
  porOnibus: Record<string, AlocacaoReserva[]>;
  /** quem ficou de fora */
  espera: AlocacaoReserva[];
  /** true quando só há 1 ônibus ativo — a UI usa `posicao` (global) em vez de `posicaoLocalidade` */
  umOnibusApenas: boolean;
}

export function alocarViagem(
  reservas: ReservaInput[],
  onibus: OnibusInput[],
): ResultadoAlocacao {
  // Ônibus ativos em ordem estável por nome (desempate quando >1 com vaga)
  const frota = [...onibus].sort((a, b) => a.nome.localeCompare(b.nome));
  const umOnibusApenas = frota.length === 1;

  // Reservas ativas ordenadas por posição na fila (seq atômico)
  const ativos = reservas
    .filter((r) => r.status !== "CANCELADA")
    .sort((a, b) => a.ordem - b.ordem);

  const ocupacao = new Map<string, number>(frota.map((o) => [o.id, 0]));

  const alocacoes: AlocacaoReserva[] = [];

  for (const r of ativos) {
    // 1. Descobre qual ônibus é o preferencial para a localidade desta pessoa
    //    (menor prioridade numérica = mais preferido)
    let preferencialId: string | null = null;
    let melhorPrio = Infinity;
    for (const bus of frota) {
      const prio = bus.prioridades[r.localidadeId] ?? Infinity;
      if (prio < melhorPrio) {
        melhorPrio = prio;
        preferencialId = bus.id;
      }
    }

    // 2. Tenta o preferencial; se cheio, qualquer outro com vaga (stable: por nome)
    const busEscolhido: OnibusInput | null = (() => {
      if (preferencialId) {
        const pref = frota.find((b) => b.id === preferencialId)!;
        if (ocupacao.get(pref.id)! < pref.capacidade) return pref;
      }
      // fallback: primeiro ônibus com vaga (alphabético, estável)
      return frota.find((b) => ocupacao.get(b.id)! < b.capacidade) ?? null;
    })();

    const transbordo = busEscolhido !== null &&
      preferencialId !== null &&
      busEscolhido.id !== preferencialId;

    if (busEscolhido) {
      const posicao = ocupacao.get(busEscolhido.id)! + 1;
      ocupacao.set(busEscolhido.id, posicao);
      alocacoes.push({
        reservaId: r.id, alunoId: r.alunoId, localidadeId: r.localidadeId,
        ordem: r.ordem, onibusId: busEscolhido.id, posicao,
        posicaoLocalidade: null, // calculado abaixo
        transbordo, podeEscolher: [], status: "CONFIRMADA",
      });
    } else {
      alocacoes.push({
        reservaId: r.id, alunoId: r.alunoId, localidadeId: r.localidadeId,
        ordem: r.ordem, onibusId: null, posicao: null,
        posicaoLocalidade: null, transbordo: false, podeEscolher: [], status: "ESPERA",
      });
    }
  }

  // 3. Calcula posicaoLocalidade: rank dentro do grupo (onibusId + localidadeId),
  //    ordenado por `ordem` global (seq da votação) → sempre 1, 2, 3… sem gaps.
  const grupos = new Map<string, AlocacaoReserva[]>();
  for (const a of alocacoes) {
    if (!a.onibusId) continue;
    const chave = `${a.onibusId}::${a.localidadeId}`;
    const g = grupos.get(chave) ?? [];
    g.push(a);
    grupos.set(chave, g);
  }
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.ordem - b.ordem);
    grupo.forEach((a, i) => { a.posicaoLocalidade = i + 1; });
  }

  // 4. Monta porOnibus e espera
  const porOnibus: Record<string, AlocacaoReserva[]> = {};
  for (const o of onibus) porOnibus[o.id] = [];
  const espera: AlocacaoReserva[] = [];
  for (const a of alocacoes) {
    if (a.onibusId) porOnibus[a.onibusId].push(a);
    else espera.push(a);
  }

  return { alocacoes, porOnibus, espera, umOnibusApenas };
}