import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";
import Dropzone from "../components/Dropzone";

type Status = "PENDENTE" | "APROVADO" | "REJEITADO";
interface Tipo { id: string; nome: string; descricao: string | null; obrigatorio: boolean; ordem: number }
interface Enviado { id: string; tipoId: string; status: Status; observacao: string | null }

const STATUS: Record<Status, { texto: string; cls: string }> = {
  PENDENTE: { texto: "Em análise", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  APROVADO: { texto: "Aprovado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  REJEITADO: { texto: "Rejeitado", cls: "bg-red-50 text-red-700 ring-red-200" },
};

// comprime imagem no navegador antes de enviar (PDF passa direto)
async function comprimir(file: File, max = 1600, q = 0.72): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

function prioridade(doc: Enviado | undefined) {
  if (!doc) return 0;
  if (doc.status === "REJEITADO") return 1;
  if (doc.status === "PENDENTE") return 2;
  return 3;
}

export default function Documentos() {
  const qc = useQueryClient();
  const [enviandoTipo, setEnviandoTipo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const [t, e] = await Promise.all([
        supabase.from("TipoDocumento").select("id,nome,descricao,obrigatorio,ordem").eq("ativo", true).order("ordem"),
        supabase.from("DocumentoEnviado").select("id,tipoId,status,observacao"),
      ]);
      return { tipos: (t.data as Tipo[]) ?? [], enviados: (e.data as Enviado[]) ?? [] };
    },
  });

  async function enviar(tipoId: string, file: File) {
    setErro(null);
    setEnviandoTipo(tipoId);
    try {
      const fd = new FormData();
      fd.set("tipoId", tipoId);
      fd.set("arquivo", await comprimir(file));
      const { data: res, error } = await supabase.functions.invoke("documento-aluno", { body: fd });
      if (error || !res?.ok) throw new Error("Falha ao enviar.");
      await qc.invalidateQueries({ queryKey: ["documentos"] });
    } catch {
      setErro("Não foi possível enviar o documento. Tente novamente.");
    } finally {
      setEnviandoTipo(null);
    }
  }

  async function verEnviado(docId: string) {
    const { data: res } = await supabase.functions.invoke("documento-aluno", { body: { docId } });
    if (res?.url) window.open(res.url, "_blank");
  }

  if (isLoading) return <p className="py-10 text-center text-sm text-slate-400">Carregando documentos…</p>;

  const porTipo = new Map((data?.enviados ?? []).map((d) => [d.tipoId, d]));
  const itens = (data?.tipos ?? [])
    .map((t) => ({ tipo: t, doc: porTipo.get(t.id) }))
    .sort((a, b) => prioridade(a.doc) - prioridade(b.doc));
  const faltam = itens.filter((i) => i.tipo.obrigatorio && (!i.doc || i.doc.status === "REJEITADO")).length;
  const emAnalise = itens.filter((i) => i.doc?.status === "PENDENTE").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Meus documentos</h1>
        <p className="text-sm text-slate-500">Envie os documentos exigidos. A secretaria valida e libera sua carteirinha.</p>
      </div>

      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {itens.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
          Nenhum documento exigido no momento.
        </p>
      ) : faltam > 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>Você tem <strong>{faltam}</strong> documento(s) obrigatório(s) pendente(s).{emAnalise > 0 && ` ${emAnalise} em análise.`}</span>
        </div>
      ) : emAnalise > 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{emAnalise} documento(s) em análise pela secretaria.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <span>Tudo certo! Seus documentos obrigatórios foram entregues.</span>
        </div>
      )}

      <div className="space-y-3">
        {itens.map(({ tipo: t, doc }) => {
          const st = doc ? STATUS[doc.status] : null;
          return (
            <div key={t.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {t.nome}
                    {t.obrigatorio && <span className="text-red-500"> *</span>}
                  </p>
                  {t.descricao && <p className="text-xs text-slate-500">{t.descricao}</p>}
                  {doc?.status === "REJEITADO" && doc.observacao && (
                    <p className="mt-0.5 text-xs text-red-600">Motivo: {doc.observacao}</p>
                  )}
                  {doc && (
                    <button onClick={() => verEnviado(doc.id)} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                      Ver enviado <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${st?.cls ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                  {st?.texto ?? "Não enviado"}
                </span>
              </div>

              {doc?.status !== "APROVADO" && (
                <div className="mt-3">
                  <Dropzone
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    ocupado={enviandoTipo === t.id}
                    titulo={doc ? "Reenviar documento" : "Enviar documento"}
                    sub="Foto ou PDF do documento"
                    onFile={(f) => enviar(t.id, f)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
