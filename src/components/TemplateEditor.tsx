import { useRef, useState } from "react";
import CarteirinhaCard from "./CarteirinhaCard";
import {
  type CampoCarteirinha,
  type CampoTipo,
  type DadosCarteirinha,
  CARTAO_ALTURA,
  CARTAO_LARGURA,
  ROTULOS_CAMPO,
  modeloPadrao,
} from "../lib/carteirinha";

const TIPOS: CampoTipo[] = ["NOME", "MATRICULA", "CURSO", "FACULDADE", "VALIDADE", "FOTO", "QRCODE", "TEXTO_FIXO"];

const DADOS_EXEMPLO: DadosCarteirinha = {
  nome: "Maria Eduarda Silva",
  matricula: "2026001234",
  curso: "Enfermagem",
  faculdade: "Faculdade de Arcoverde",
  validade: new Date("2026-12-31"),
  fotoUrl: null,
  qrValor: "https://sysbus.app/v/exemplo",
};

export interface TemplateInicial {
  arteUrl: string | null;
  arteVersoUrl: string | null;
  larguraBase: number;
  alturaBase: number;
  campos: CampoCarteirinha[];
}

export interface PayloadSalvar {
  larguraBase: number;
  alturaBase: number;
  campos: CampoCarteirinha[];
  arteFile: File | null;
  arteUrlExistente: string | null;
  arteVersoFile: File | null;
  arteVersoUrlExistente: string | null;
}

interface Props {
  inicial?: TemplateInicial;
  dadosPrevia?: DadosCarteirinha;
  onSalvar?: (p: PayloadSalvar) => Promise<{ ok: boolean; erro?: string }>;
}

export default function TemplateEditor({ inicial, dadosPrevia, onSalvar }: Props) {
  const [arteUrl, setArteUrl] = useState<string | null>(inicial?.arteUrl ?? null);
  const [arteFile, setArteFile] = useState<File | null>(null);
  const [larguraBase, setLarguraBase] = useState(inicial?.larguraBase ?? CARTAO_LARGURA);
  const [alturaBase, setAlturaBase] = useState(inicial?.alturaBase ?? CARTAO_ALTURA);
  const [campos, setCampos] = useState<CampoCarteirinha[]>(inicial?.campos ?? modeloPadrao());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const inputArte = useRef<HTMLInputElement>(null);
  const [versoUrl, setVersoUrl] = useState<string | null>(inicial?.arteVersoUrl ?? null);
  const [versoFile, setVersoFile] = useState<File | null>(null);
  const [face, setFace] = useState<"FRENTE" | "VERSO">("FRENTE");

  const selecionado = campos.find((c) => c.id === selecionadoId) ?? null;
  const dados = dadosPrevia ?? DADOS_EXEMPLO;
  const arteDaFace = face === "FRENTE" ? arteUrl : versoUrl;
  const camposDaFace = campos.filter((c) => c.face === face).length;

  // sobe a arte da FACE atual (frente ou verso)
  function aoEscolherArte(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (face === "FRENTE") {
        setArteFile(file);
        const img = new Image();
        img.onload = () => { setLarguraBase(img.naturalWidth); setAlturaBase(img.naturalHeight); setArteUrl(url); };
        img.src = url;
      } else {
        setVersoFile(file);
        setVersoUrl(url);
      }
    };
    reader.readAsDataURL(file);
  }

  function atualizar(id: string, patch: Partial<CampoCarteirinha>) {
    setCampos((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function adicionar(tipo: CampoTipo) {
    const ehMidia = tipo === "FOTO" || tipo === "QRCODE";
    const novo: CampoCarteirinha = {
      id: crypto.randomUUID(),
      tipo,
      face,
      x: Math.round(larguraBase / 2 - (ehMidia ? 100 : 150)),
      y: Math.round(alturaBase / 2 - (ehMidia ? 100 : 25)),
      largura: ehMidia ? 200 : 300,
      altura: ehMidia ? 200 : 50,
      fonteTamanho: tipo === "NOME" ? 40 : 28,
      cor: "#111111",
      negrito: tipo === "NOME",
      alinhamento: "left",
      textoFixo: tipo === "TEXTO_FIXO" ? "Texto" : undefined,
    };
    setCampos((cs) => [...cs, novo]);
    setSelecionadoId(novo.id);
  }

  function remover(id: string) {
    setCampos((cs) => cs.filter((c) => c.id !== id));
    if (selecionadoId === id) setSelecionadoId(null);
  }

  async function salvar() {
    if (!onSalvar) return;
    setSalvando(true);
    setMsg(null);
    const res = await onSalvar({
      larguraBase, alturaBase, campos,
      arteFile, arteUrlExistente: arteFile ? null : arteUrl,
      arteVersoFile: versoFile, arteVersoUrlExistente: versoFile ? null : versoUrl,
    });
    setSalvando(false);
    setMsg(res.ok ? { tipo: "ok", texto: "Template salvo com sucesso." } : { tipo: "erro", texto: res.erro ?? "Erro ao salvar." });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* alterna a FACE editada — cada face tem sua arte e seus campos */}
          <div className="inline-flex rounded-lg ring-1 ring-slate-300">
            {(["FRENTE", "VERSO"] as const).map((fc) => (
              <button
                key={fc}
                onClick={() => { setFace(fc); setSelecionadoId(null); }}
                className={`px-3 py-1.5 text-sm font-medium first:rounded-l-lg last:rounded-r-lg ${face === fc ? "bg-brand-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {fc === "FRENTE" ? "Frente" : "Verso"}
              </button>
            ))}
          </div>
          <button onClick={() => inputArte.current?.click()} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {arteDaFace ? "Trocar arte" : "Subir arte"} ({face === "FRENTE" ? "frente" : "verso"})
          </button>
          <input ref={inputArte} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={aoEscolherArte} />
          <span className="text-xs text-slate-400">base {larguraBase}×{alturaBase}px · {camposDaFace} campo(s) nesta face</span>
          {onSalvar && (
            <button onClick={salvar} disabled={salvando} className="ml-auto rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
              {salvando ? "Salvando..." : "Salvar template"}
            </button>
          )}
        </div>

        {msg && (
          <p className={`rounded-md px-3 py-2 text-sm ${msg.tipo === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.texto}</p>
        )}

        <div className="overflow-x-auto">
          <CarteirinhaCard
            campos={campos}
            dados={dados}
            face={face}
            arteUrl={arteDaFace}
            larguraBase={larguraBase}
            alturaBase={alturaBase}
            larguraExibicao={680}
            campoSelecionadoId={selecionadoId}
            onSelecionarCampo={setSelecionadoId}
            onMoverCampo={(id, x, y) => atualizar(id, { x, y })}
            onRedimensionarCampo={(id, patch) => atualizar(id, patch)}
          />
        </div>
        <p className="text-xs text-slate-400">
          Arraste o campo para mover e puxe os <b>cantos azuis</b> para redimensionar. O mesmo template vale para todos os alunos desta rota.
        </p>
      </div>

      <aside className="space-y-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Adicionar campo</h2>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map((t) => (
              <button key={t} onClick={() => adicionar(t)} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
                + {ROTULOS_CAMPO[t]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Campo selecionado</h2>
          {!selecionado ? (
            <p className="text-xs text-slate-400">Selecione um campo no cartão.</p>
          ) : (
            <PropriedadesCampo campo={selecionado} onChange={(patch) => atualizar(selecionado.id, patch)} onRemover={() => remover(selecionado.id)} />
          )}
        </section>

      </aside>
    </div>
  );
}

function PropriedadesCampo({ campo, onChange, onRemover }: { campo: CampoCarteirinha; onChange: (patch: Partial<CampoCarteirinha>) => void; onRemover: () => void }) {
  const ehTexto = campo.tipo !== "FOTO" && campo.tipo !== "QRCODE";
  const Num = ({ label, valor, chave }: { label: string; valor: number; chave: keyof CampoCarteirinha }) => (
    <label className="flex flex-col text-xs text-slate-600">
      {label}
      <input type="number" value={valor} onChange={(e) => onChange({ [chave]: Number(e.target.value) } as Partial<CampoCarteirinha>)} className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm" />
    </label>
  );

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <label className="flex flex-col text-xs text-slate-600">
        Tipo
        <select value={campo.tipo} onChange={(e) => onChange({ tipo: e.target.value as CampoTipo })} className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm">
          {TIPOS.map((t) => <option key={t} value={t}>{ROTULOS_CAMPO[t]}</option>)}
        </select>
      </label>

      <p className="rounded-md bg-brand-50 px-2 py-1.5 text-[11px] text-brand-700">
        Arraste o campo no cartão para mover e puxe os cantos para redimensionar. Use os números só para ajuste fino.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Num label="X" valor={campo.x} chave="x" />
        <Num label="Y" valor={campo.y} chave="y" />
        <Num label="Largura" valor={campo.largura} chave="largura" />
        <Num label="Altura" valor={campo.altura} chave="altura" />
      </div>

      {campo.tipo === "TEXTO_FIXO" && (
        <label className="flex flex-col text-xs text-slate-600">
          Texto fixo
          <input type="text" value={campo.textoFixo ?? ""} onChange={(e) => onChange({ textoFixo: e.target.value })} className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm" />
        </label>
      )}

      {ehTexto && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Num label="Tamanho fonte" valor={campo.fonteTamanho ?? 28} chave="fonteTamanho" />
            <label className="flex flex-col text-xs text-slate-600">
              Cor
              <input type="color" value={campo.cor ?? "#111111"} onChange={(e) => onChange({ cor: e.target.value })} className="mt-0.5 h-8 w-full rounded border border-slate-300" />
            </label>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="checkbox" checked={campo.negrito ?? false} onChange={(e) => onChange({ negrito: e.target.checked })} />
              Negrito
            </label>
            <label className="flex flex-col text-xs text-slate-600">
              Alinhamento
              <select value={campo.alinhamento ?? "left"} onChange={(e) => onChange({ alinhamento: e.target.value as "left" | "center" | "right" })} className="mt-0.5 rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </label>
          </div>
        </>
      )}

      <button onClick={onRemover} className="w-full rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50">Remover campo</button>
    </div>
  );
}
