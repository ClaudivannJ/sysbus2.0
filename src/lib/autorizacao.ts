// Situação de autorização do aluno para usar o transporte — lógica idêntica ao
// sistema anterior. Ajuste para o SPA: `validade` pode vir como string ISO (o
// PostgREST devolve timestamps como texto), então normalizamos.

type StatusRenovacao = "PENDENTE" | "APROVADA" | "REJEITADA";

/**
 *  - AUTORIZADO    : carteirinha com validade vigente (documentação aprovada).
 *  - EM_ANALISE    : enviou documentação e aguarda a secretaria.
 *  - NAO_AUTORIZADO: sem autorização válida e sem pedido pendente.
 */
export type SituacaoAutorizacao = "AUTORIZADO" | "EM_ANALISE" | "NAO_AUTORIZADO";

export function situacaoAutorizacao(aluno: {
  carteirinha: { validade: string | Date | null } | null;
  renovacoes?: { status: StatusRenovacao }[];
}): SituacaoAutorizacao {
  const v = aluno.carteirinha?.validade ?? null;
  const t = v ? new Date(v).getTime() : null;
  if (t !== null && t >= Date.now()) return "AUTORIZADO";
  if (aluno.renovacoes?.some((r) => r.status === "PENDENTE")) return "EM_ANALISE";
  return "NAO_AUTORIZADO";
}

export const LABEL_AUTORIZACAO: Record<
  SituacaoAutorizacao,
  { texto: string; tom: "success" | "warning" | "danger" }
> = {
  AUTORIZADO: { texto: "Autorizado", tom: "success" },
  EM_ANALISE: { texto: "Em análise", tom: "warning" },
  NAO_AUTORIZADO: { texto: "Não autorizado", tom: "danger" },
};
