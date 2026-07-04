import { createPortal } from "react-dom";
import CarteirinhaCard from "./CarteirinhaCard";
import type { CampoCarteirinha, DadosCarteirinha } from "../lib/carteirinha";

/**
 * Carteirinha para IMPRESSÃO padronizada: frente + verso no TAMANHO REAL de cartão
 * (padrão ID-1 / CR80 ≈ 85,6 × 54 mm), as duas faces na MESMA página (economiza papel
 * e sai igual para todo aluno). Renderiza num portal no <body>; no print o #root some e
 * só esta camada aparece (regras em index.css). Chame window.print() para gerar o PDF.
 */

// 85,6 mm em px a 96 dpi (1px = 1/96") → no PDF cada face sai no tamanho físico de um cartão.
const LARGURA_CARTAO_PX = Math.round((85.6 / 25.4) * 96); // ≈ 324

export default function CarteirinhaImpressao({
  campos, dados, arteUrl, arteVersoUrl, larguraBase, alturaBase,
}: {
  campos: CampoCarteirinha[];
  dados: DadosCarteirinha;
  arteUrl: string | null;
  arteVersoUrl: string | null;
  larguraBase: number;
  alturaBase: number;
}) {
  const largura = LARGURA_CARTAO_PX;
  const altura = (largura * alturaBase) / larguraBase;
  const conteudo = (
    <div className="carteirinha-print">
      <div style={{ display: "flex", flexDirection: "column", gap: "6mm", alignItems: "flex-start" }}>
        <div className="face-print">
          <CarteirinhaCard
            campos={campos}
            dados={dados}
            face="FRENTE"
            arteUrl={arteUrl}
            larguraBase={larguraBase}
            alturaBase={alturaBase}
            larguraExibicao={largura}
          />
        </div>
        {arteVersoUrl && (
          <div className="face-print">
            <img
              src={arteVersoUrl}
              alt="Verso da carteirinha"
              style={{ width: largura, height: altura, objectFit: "cover", borderRadius: 10, display: "block" }}
            />
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(conteudo, document.body);
}
