import { createPortal } from "react-dom";
import CarteirinhaCard from "./CarteirinhaCard";
import type { CampoCarteirinha, DadosCarteirinha } from "../lib/carteirinha";

/**
 * Carteirinha pronta para IMPRESSÃO (frente + verso). Renderiza num portal no <body>
 * (fora do #root) e só aparece no print — regras em index.css escondem o #root e mostram
 * esta camada, gerando exatamente 1 página por face. Chame window.print().
 */
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
  const largura = 640;
  const altura = (largura * alturaBase) / larguraBase;
  const conteudo = (
    <div className="carteirinha-print">
      <div className="face-print" style={{ padding: 24 }}>
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
        <div className="face-print" style={{ padding: 24 }}>
          <img
            src={arteVersoUrl}
            alt="Verso da carteirinha"
            style={{ width: largura, height: altura, objectFit: "cover", borderRadius: 12 }}
          />
        </div>
      )}
    </div>
  );
  return createPortal(conteudo, document.body);
}
