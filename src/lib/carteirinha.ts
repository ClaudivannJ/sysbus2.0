/**
 * Tipos e helpers do template da carteirinha.
 *
 * O template (ModeloCarteirinha) guarda uma arte de fundo + uma lista de campos
 * posicionados. O mesmo template é usado para TODOS os alunos da faculdade:
 * a secretaria desenha uma vez, o sistema preenche os dados de cada aluno.
 *
 * Coordenadas em pixels sobre a "base" do cartão (modelo.largura x modelo.altura).
 * Na renderização a base é escalada para caber no container (ver CarteirinhaCard).
 */

export type FaceCarteirinha = "FRENTE" | "VERSO";

export type CampoTipo =
  | "NOME"
  | "MATRICULA"
  | "CURSO"
  | "FACULDADE"
  | "VALIDADE"
  | "FOTO"
  | "QRCODE"
  | "TEXTO_FIXO";

export interface CampoCarteirinha {
  id: string;
  tipo: CampoTipo;
  face: FaceCarteirinha;
  /** posição do canto superior esquerdo, em px da base */
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** aparência (ignorado em FOTO/QRCODE) */
  fonteTamanho?: number;
  cor?: string;
  negrito?: boolean;
  alinhamento?: "left" | "center" | "right";
  /** usado apenas quando tipo === "TEXTO_FIXO" */
  textoFixo?: string;
}

/** Dados de um aluno para preencher o template. */
export interface DadosCarteirinha {
  nome: string;
  matricula?: string | null;
  curso?: string | null;
  faculdade: string;
  validade?: Date | string | null;
  fotoUrl?: string | null;
  /** valor codificado no QR (token assinado ou URL de verificação) */
  qrValor: string;
}

export const ROTULOS_CAMPO: Record<CampoTipo, string> = {
  NOME: "Nome",
  MATRICULA: "Matrícula",
  CURSO: "Curso",
  FACULDADE: "Faculdade",
  VALIDADE: "Validade",
  FOTO: "Foto",
  QRCODE: "QR Code",
  TEXTO_FIXO: "Texto fixo",
};

export function formatarValidade(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  // ancorado no fuso de Pernambuco (senão datas perto da meia-noite viram o dia seguinte)
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Texto a exibir para um campo de texto, a partir dos dados do aluno. */
export function textoDoCampo(campo: CampoCarteirinha, dados: DadosCarteirinha): string {
  switch (campo.tipo) {
    case "NOME":
      return dados.nome;
    case "MATRICULA":
      return dados.matricula ?? "—";
    case "CURSO":
      return dados.curso ?? "—";
    case "FACULDADE":
      return dados.faculdade;
    case "VALIDADE":
      return formatarValidade(dados.validade);
    case "TEXTO_FIXO":
      return campo.textoFixo ?? "";
    default:
      return "";
  }
}

/** Tamanho padrão do cartão (CR80, 85,6 x 54 mm @ 300 dpi). */
export const CARTAO_LARGURA = 1012;
export const CARTAO_ALTURA = 638;

let _seq = 0;
function novoId(tipo: string) {
  _seq += 1;
  return `${tipo.toLowerCase()}-${_seq}`;
}

/**
 * Template inicial sugerido — a secretaria começa por aqui e arrasta/ajusta.
 * Posições pensadas para um cartão "retrato de info à direita, foto à esquerda".
 */
export function modeloPadrao(): CampoCarteirinha[] {
  return [
    {
      id: novoId("FOTO"),
      tipo: "FOTO",
      face: "FRENTE",
      x: 48,
      y: 160,
      largura: 260,
      altura: 340,
    },
    {
      id: novoId("NOME"),
      tipo: "NOME",
      face: "FRENTE",
      x: 340,
      y: 180,
      largura: 620,
      altura: 60,
      fonteTamanho: 40,
      negrito: true,
      cor: "#111111",
      alinhamento: "left",
    },
    {
      id: novoId("CURSO"),
      tipo: "CURSO",
      face: "FRENTE",
      x: 340,
      y: 250,
      largura: 620,
      altura: 40,
      fonteTamanho: 28,
      cor: "#333333",
      alinhamento: "left",
    },
    {
      id: novoId("MATRICULA"),
      tipo: "MATRICULA",
      face: "FRENTE",
      x: 340,
      y: 300,
      largura: 620,
      altura: 40,
      fonteTamanho: 28,
      cor: "#333333",
      alinhamento: "left",
    },
    {
      id: novoId("VALIDADE"),
      tipo: "VALIDADE",
      face: "FRENTE",
      x: 340,
      y: 350,
      largura: 620,
      altura: 40,
      fonteTamanho: 28,
      cor: "#333333",
      alinhamento: "left",
    },
    {
      id: novoId("QRCODE"),
      tipo: "QRCODE",
      face: "FRENTE",
      x: 760,
      y: 420,
      largura: 200,
      altura: 200,
    },
  ];
}
