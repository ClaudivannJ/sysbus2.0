import {
  type CampoCarteirinha,
  type DadosCarteirinha,
  CARTAO_ALTURA,
  CARTAO_LARGURA,
  modeloPadrao,
} from "./carteirinha";

/** Dados mínimos para renderizar a carteirinha de um aluno. */
export interface AlunoParaCartao {
  nome: string;
  matricula?: string | null;
  curso?: string | null;
  fotoUrl?: string | null;
  /** nome da faculdade do aluno (texto exibido no cartão) */
  faculdade?: string | null;
  /** rota/cidade do aluno — define o template (arte + campos) */
  destino: {
    modelo: {
      campos: unknown;
      largura: number;
      altura: number;
      arteFrenteUrl: string | null;
      arteVersoUrl: string | null;
    } | null;
  } | null;
  // PostgREST devolve a validade como string ISO (não Date).
  carteirinha: { qrToken: string; validade: string | Date | null } | null;
}

/**
 * URL pública usada no QR Code (aponta para a página de verificação /v/:token).
 * No SPA usamos a própria origem; pode ser sobrescrita por VITE_APP_URL.
 */
export function appUrl(): string {
  return (
    (import.meta.env.VITE_APP_URL as string | undefined) ??
    (typeof window !== "undefined" ? window.location.origin : "")
  );
}

/** Monta as props do CarteirinhaCard a partir do aluno + template da rota. */
export function montarCarteirinha(aluno: AlunoParaCartao) {
  const m = aluno.destino?.modelo ?? null;
  return {
    dados: {
      nome: aluno.nome,
      matricula: aluno.matricula ?? null,
      curso: aluno.curso ?? null,
      faculdade: aluno.faculdade ?? "",
      validade: aluno.carteirinha?.validade ?? null,
      fotoUrl: aluno.fotoUrl ?? null,
      qrValor: aluno.carteirinha
        ? `${appUrl()}/v/${aluno.carteirinha.qrToken}`
        : "",
    } satisfies DadosCarteirinha,
    campos: (m?.campos as CampoCarteirinha[] | undefined) ?? modeloPadrao(),
    arteUrl: m?.arteFrenteUrl ?? null,
    arteVersoUrl: m?.arteVersoUrl ?? null,
    larguraBase: m?.largura ?? CARTAO_LARGURA,
    alturaBase: m?.altura ?? CARTAO_ALTURA,
    temTemplate: Boolean(m),
  };
}
