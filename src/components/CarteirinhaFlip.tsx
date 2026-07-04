import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import CarteirinhaCard from "./CarteirinhaCard";
import type { CampoCarteirinha, DadosCarteirinha } from "../lib/carteirinha";

interface Props {
  campos: CampoCarteirinha[];
  dados: DadosCarteirinha;
  arteFrenteUrl: string | null;
  arteVersoUrl: string | null;
  larguraBase: number;
  alturaBase: number;
  larguraExibicao?: number;
}

export default function CarteirinhaFlip({
  campos,
  dados,
  arteFrenteUrl,
  arteVersoUrl,
  larguraBase,
  alturaBase,
  larguraExibicao = 460,
}: Props) {
  const [virado, setVirado] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // largura responsiva: nunca passa do container (não estoura no celular)
  const [largura, setLargura] = useState(larguraExibicao);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const medir = () => setLargura(Math.min(larguraExibicao, el.clientWidth));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [larguraExibicao]);

  const altura = (largura * alturaBase) / larguraBase;

  // sem verso: mostra só a frente
  if (!arteVersoUrl) {
    return (
      <div ref={wrapRef} className="w-full">
        <CarteirinhaCard
          campos={campos}
          dados={dados}
          arteUrl={arteFrenteUrl}
          larguraBase={larguraBase}
          alturaBase={alturaBase}
          larguraExibicao={largura}
        />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="flex w-full flex-col items-center gap-3">
      <div style={{ width: largura, height: altura, perspective: 1400 }}>
        <div
          className="relative h-full w-full transition-transform duration-700 ease-out"
          style={{
            transformStyle: "preserve-3d",
            transform: virado ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* frente */}
          <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
            <CarteirinhaCard
              campos={campos}
              dados={dados}
              arteUrl={arteFrenteUrl}
              larguraBase={larguraBase}
              alturaBase={alturaBase}
              larguraExibicao={largura}
            />
          </div>
          {/* verso */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <img
              src={arteVersoUrl}
              alt="Verso da carteirinha"
              className="h-full w-full rounded-xl object-cover shadow-md ring-1 ring-black/10"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => setVirado((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <RotateCw className="h-4 w-4" />
        {virado ? "Ver frente" : "Virar cartão"}
      </button>
    </div>
  );
}
