import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  type CampoCarteirinha,
  type DadosCarteirinha,
  type FaceCarteirinha,
  CARTAO_ALTURA,
  CARTAO_LARGURA,
  textoDoCampo,
} from "../lib/carteirinha";

interface Props {
  campos: CampoCarteirinha[];
  dados: DadosCarteirinha;
  face?: FaceCarteirinha;
  arteUrl?: string | null;
  larguraBase?: number;
  alturaBase?: number;
  larguraExibicao?: number;
  corFundo?: string;
  campoSelecionadoId?: string | null;
  onSelecionarCampo?: (id: string) => void;
  /** mover campo (modo editor) */
  onMoverCampo?: (id: string, x: number, y: number) => void;
  /** redimensionar/reposicionar campo via alças (modo editor) */
  onRedimensionarCampo?: (
    id: string,
    patch: { x: number; y: number; largura: number; altura: number },
  ) => void;
}

type Canto = "nw" | "ne" | "sw" | "se";

const CANTOS: { canto: Canto; classe: string; cursor: string }[] = [
  { canto: "nw", classe: "-top-1.5 -left-1.5", cursor: "nwse-resize" },
  { canto: "ne", classe: "-top-1.5 -right-1.5", cursor: "nesw-resize" },
  { canto: "sw", classe: "-bottom-1.5 -left-1.5", cursor: "nesw-resize" },
  { canto: "se", classe: "-bottom-1.5 -right-1.5", cursor: "nwse-resize" },
];

const MIN = 16;

export default function CarteirinhaCard({
  campos,
  dados,
  face = "FRENTE",
  arteUrl,
  larguraBase = CARTAO_LARGURA,
  alturaBase = CARTAO_ALTURA,
  larguraExibicao = 506,
  corFundo = "#f1f5f9",
  campoSelecionadoId,
  onSelecionarCampo,
  onMoverCampo,
  onRedimensionarCampo,
}: Props) {
  const escala = larguraExibicao / larguraBase;
  const [qrDataUrl, setQrDataUrl] = useState("");
  const arrasto = useRef<{
    tipo: "mover" | "resize";
    id: string;
    canto?: Canto;
    tipoCampo: string;
    startX: number;
    startY: number;
    orig: { x: number; y: number; largura: number; altura: number };
  } | null>(null);

  useEffect(() => {
    let ativo = true;
    QRCode.toDataURL(dados.qrValor, { margin: 0, width: 512, errorCorrectionLevel: "M" })
      .then((url) => ativo && setQrDataUrl(url))
      .catch(() => ativo && setQrDataUrl(""));
    return () => {
      ativo = false;
    };
  }, [dados.qrValor]);

  // Ajusta a fonte de cada campo de texto para caber na largura (nomes longos
  // encolhem em vez de serem cortados).
  const [fontes, setFontes] = useState<Record<string, number>>({});
  useEffect(() => {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    const novo: Record<string, number> = {};
    for (const c of campos) {
      if (c.face !== face || c.tipo === "FOTO" || c.tipo === "QRCODE") continue;
      const texto = textoDoCampo(c, dados);
      const base = (c.fonteTamanho ?? 28) * escala;
      if (!texto) {
        novo[c.id] = base;
        continue;
      }
      ctx.font = `${c.negrito ? 700 : 400} ${base}px ui-sans-serif, system-ui, sans-serif`;
      const largura = ctx.measureText(texto).width;
      const max = c.largura * escala * 0.96;
      novo[c.id] = largura > max ? Math.max(8, (base * max) / largura) : base;
    }
    setFontes(novo);
  }, [campos, dados, escala, face]);

  const editavel = Boolean(onMoverCampo || onSelecionarCampo);

  function iniciarMover(e: React.PointerEvent, campo: CampoCarteirinha) {
    onSelecionarCampo?.(campo.id);
    if (!onMoverCampo) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrasto.current = {
      tipo: "mover",
      id: campo.id,
      tipoCampo: campo.tipo,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: campo.x, y: campo.y, largura: campo.largura, altura: campo.altura },
    };
  }

  function iniciarResize(e: React.PointerEvent, campo: CampoCarteirinha, canto: Canto) {
    e.preventDefault();
    e.stopPropagation();
    if (!onRedimensionarCampo) return;
    onSelecionarCampo?.(campo.id);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrasto.current = {
      tipo: "resize",
      id: campo.id,
      canto,
      tipoCampo: campo.tipo,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: campo.x, y: campo.y, largura: campo.largura, altura: campo.altura },
    };
  }

  function aoMover(e: React.PointerEvent) {
    const a = arrasto.current;
    if (!a) return;
    const dx = (e.clientX - a.startX) / escala;
    const dy = (e.clientY - a.startY) / escala;

    if (a.tipo === "mover" && onMoverCampo) {
      onMoverCampo(
        a.id,
        Math.max(0, Math.round(a.orig.x + dx)),
        Math.max(0, Math.round(a.orig.y + dy)),
      );
      return;
    }

    if (a.tipo === "resize" && onRedimensionarCampo && a.canto) {
      let { x, y, largura, altura } = a.orig;
      if (a.canto.includes("e")) largura = Math.max(MIN, Math.round(a.orig.largura + dx));
      if (a.canto.includes("s")) altura = Math.max(MIN, Math.round(a.orig.altura + dy));
      if (a.canto.includes("w")) {
        largura = Math.max(MIN, Math.round(a.orig.largura - dx));
        x = Math.round(a.orig.x + (a.orig.largura - largura));
      }
      if (a.canto.includes("n")) {
        altura = Math.max(MIN, Math.round(a.orig.altura - dy));
        y = Math.round(a.orig.y + (a.orig.altura - altura));
      }
      if (a.tipoCampo === "QRCODE") {
        const lado = Math.max(largura, altura);
        largura = lado;
        altura = lado;
      }
      onRedimensionarCampo(a.id, { x: Math.max(0, x), y: Math.max(0, y), largura, altura });
    }
  }

  function aoSoltar(e: React.PointerEvent) {
    if (arrasto.current) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      arrasto.current = null;
    }
  }

  const camposDaFace = campos.filter((c) => c.face === face);

  function conteudo(campo: CampoCarteirinha) {
    if (campo.tipo === "FOTO") {
      return dados.fotoUrl ? (
        <img
          src={dados.fotoUrl}
          alt="Foto do aluno"
          className="pointer-events-none h-full w-full rounded object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded bg-black/10 text-[10px] text-black/40">
          FOTO
        </div>
      );
    }
    if (campo.tipo === "QRCODE") {
      return qrDataUrl ? (
        <img src={qrDataUrl} alt="QR Code" className="pointer-events-none h-full w-full" />
      ) : (
        <div className="h-full w-full bg-black/10" />
      );
    }
    return (
      <div
        className="pointer-events-none flex h-full w-full overflow-hidden"
        style={{
          alignItems: "center",
          justifyContent:
            campo.alinhamento === "center"
              ? "center"
              : campo.alinhamento === "right"
                ? "flex-end"
                : "flex-start",
          fontSize: fontes[campo.id] ?? (campo.fonteTamanho ?? 28) * escala,
          color: campo.cor ?? "#111111",
          fontWeight: campo.negrito ? 700 : 400,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        {textoDoCampo(campo, dados)}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl shadow-md ring-1 ring-black/10 select-none"
      style={{
        width: larguraExibicao,
        height: alturaBase * escala,
        background: corFundo,
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* arte de fundo como imagem real (imprime no PDF, diferente de background CSS) */}
      {arteUrl && (
        <img
          src={arteUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      )}

      {camposDaFace.map((campo) => {
        const selecionado = campoSelecionadoId === campo.id;
        const move = onMoverCampo
          ? {
              onPointerDown: (e: React.PointerEvent) => iniciarMover(e, campo),
              onPointerMove: aoMover,
              onPointerUp: aoSoltar,
            }
          : onSelecionarCampo
            ? { onClick: () => onSelecionarCampo(campo.id) }
            : {};

        return (
          <div
            key={campo.id}
            {...move}
            style={{
              position: "absolute",
              left: campo.x * escala,
              top: campo.y * escala,
              width: campo.largura * escala,
              height: campo.altura * escala,
              outline: selecionado
                ? "2px solid #1d527f"
                : editavel
                  ? "1px dashed rgba(29,82,127,0.45)"
                  : undefined,
              touchAction: onMoverCampo ? "none" : undefined,
              cursor: onMoverCampo ? "move" : onSelecionarCampo ? "pointer" : undefined,
            }}
          >
            {conteudo(campo)}

            {selecionado &&
              onRedimensionarCampo &&
              CANTOS.map(({ canto, classe, cursor }) => (
                <span
                  key={canto}
                  onPointerDown={(e) => iniciarResize(e, campo, canto)}
                  onPointerMove={aoMover}
                  onPointerUp={aoSoltar}
                  className={`absolute z-10 h-3 w-3 rounded-sm border border-blue-800 bg-white ${classe}`}
                  style={{ cursor, touchAction: "none" }}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
