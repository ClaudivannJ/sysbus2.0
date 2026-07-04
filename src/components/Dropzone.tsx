import { useState } from "react";
import { UploadCloud } from "lucide-react";

/** Área de upload evidente (clique ou arraste). Chama onFile ao escolher/soltar o arquivo. */
export default function Dropzone({
  accept, onFile, titulo, sub, atual, ocupado,
}: {
  accept: string;
  onFile: (f: File) => void;
  titulo?: string;
  sub?: string;
  atual?: string | null;
  ocupado?: boolean;
}) {
  const [sobre, setSobre] = useState(false);
  const [nome, setNome] = useState<string | null>(null);

  function escolher(f?: File | null) {
    if (f) { setNome(f.name); onFile(f); }
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => { e.preventDefault(); setSobre(false); escolher(e.dataTransfer.files?.[0]); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
        sobre ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/50"
      } ${ocupado ? "pointer-events-none opacity-60" : ""}`}
    >
      <UploadCloud className="h-7 w-7 text-brand-600" />
      <span className="text-sm font-medium text-slate-700">
        {ocupado ? "Enviando…" : (titulo ?? "Clique para escolher ou arraste o arquivo")}
      </span>
      <span className="text-xs text-slate-400">{nome ?? atual ?? sub ?? "PNG, JPG ou PDF"}</span>
      <input type="file" accept={accept} className="hidden" disabled={ocupado} onChange={(e) => escolher(e.target.files?.[0])} />
    </label>
  );
}
