import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { useAluno } from "./useAluno";
import { montarCarteirinha } from "../lib/carteirinha-render";
import { situacaoAutorizacao, LABEL_AUTORIZACAO } from "../lib/autorizacao";
import { formatarValidade } from "../lib/carteirinha";
import { supabase } from "../lib/supabase";
import CarteirinhaFlip from "../components/CarteirinhaFlip";
import CarteirinhaImpressao from "../components/CarteirinhaImpressao";
import { Printer, Nfc } from "lucide-react";

type NDEFWriter = { write(msg: { records: { recordType: string; data: string }[] }): Promise<void> };
type NDEFWriterCtor = new () => NDEFWriter;

function GravarNfc({ qrValor }: { qrValor: string }) {
  const [estado, setEstado] = useState<"ocioso" | "gravando" | "ok" | "erro">("ocioso");
  const { data: cfg } = useQuery({
    queryKey: ["config-plataforma-portal"],
    queryFn: async () => {
      const { data } = await supabase.from("ConfiguracaoPlataforma").select("nfcAtivo").eq("id", "GLOBAL").maybeSingle();
      return (data as { nfcAtivo: boolean } | null) ?? { nfcAtivo: false };
    },
  });
  const Ctor = (window as unknown as { NDEFReader?: NDEFWriterCtor }).NDEFReader;
  if (!cfg?.nfcAtivo || !Ctor) return null; // só quando o DONO habilitou o NFC e o aparelho suporta

  async function gravar() {
    setEstado("gravando");
    try {
      await new Ctor!().write({ records: [{ recordType: "url", data: qrValor }] });
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <button onClick={gravar} disabled={estado === "gravando"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
        <Nfc className="h-4 w-4" /> {estado === "gravando" ? "Encoste a tag NFC…" : "Gravar carteirinha em tag NFC"}
      </button>
      {estado === "ok" && <p className="mt-2 text-center text-xs text-emerald-600">Tag gravada. Já pode usar a aproximação no embarque.</p>}
      {estado === "erro" && <p className="mt-2 text-center text-xs text-red-600">Não foi possível gravar. Aproxime uma tag NFC regravável e tente de novo.</p>}
    </div>
  );
}

const TOM: Record<"success" | "warning" | "danger", string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
};

export default function Carteirinha() {
  const { perfil } = useAuth();
  const { data: aluno, isLoading, error } = useAluno(perfil?.id);

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-slate-400">Carregando carteirinha…</p>;
  }
  if (error) {
    return (
      <p className="py-10 text-center text-sm text-red-600">
        Não foi possível carregar seus dados. Tente novamente.
      </p>
    );
  }
  if (!aluno) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Nenhum cadastro de aluno encontrado para esta conta.
      </p>
    );
  }

  const cartao = montarCarteirinha(aluno);
  const situacao = situacaoAutorizacao(aluno);
  const label = LABEL_AUTORIZACAO[situacao];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Minha carteirinha</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${TOM[label.tom]}`}
        >
          {situacao === "AUTORIZADO" ? `Válida · até ${formatarValidade(cartao.dados.validade)}` : label.texto}
        </span>
      </div>

      <div className="flex justify-center rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <CarteirinhaFlip
          campos={cartao.campos}
          dados={cartao.dados}
          arteFrenteUrl={cartao.arteUrl}
          arteVersoUrl={cartao.arteVersoUrl}
          larguraBase={cartao.larguraBase}
          alturaBase={cartao.alturaBase}
        />
      </div>

      {situacao === "AUTORIZADO" && (
        <button
          onClick={() => window.print()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF (frente e verso)
        </button>
      )}

      {situacao === "AUTORIZADO" && <GravarNfc qrValor={cartao.dados.qrValor} />}

      <CarteirinhaImpressao
        campos={cartao.campos}
        dados={cartao.dados}
        arteUrl={cartao.arteUrl}
        arteVersoUrl={cartao.arteVersoUrl}
        larguraBase={cartao.larguraBase}
        alturaBase={cartao.alturaBase}
      />

      {situacao === "NAO_AUTORIZADO" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Sua autorização do semestre ainda não está válida. Envie a documentação em{" "}
          <strong>Documentos</strong> para liberar o uso do transporte.
        </p>
      )}
    </div>
  );
}
