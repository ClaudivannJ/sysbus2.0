import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Check, X, ExternalLink } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Renov {
  id: string;
  semestre: string;
  comprovanteUrl: string | null;
  criadoEm: string;
  aluno: { nome: string; curso: string | null } | { nome: string; curso: string | null }[] | null;
}

function alunoDe(r: Renov) {
  return Array.isArray(r.aluno) ? r.aluno[0] : r.aluno;
}

export default function Autorizacoes() {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["renovacoes-pendentes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("Renovacao")
        .select("id, semestre, comprovanteUrl, criadoEm, aluno:Aluno ( nome, curso )")
        .eq("status", "PENDENTE")
        .order("criadoEm", { ascending: true });
      return (data as Renov[]) ?? [];
    },
  });

  async function aprovar(id: string) {
    setOcupado(id);
    await supabase.functions.invoke("avaliar-renovacao", { body: { action: "aprovar", id } });
    await qc.invalidateQueries({ queryKey: ["renovacoes-pendentes"] });
    setOcupado(null);
  }

  async function rejeitar(id: string) {
    const observacao = window.prompt("Motivo da rejeição (opcional):") ?? "";
    setOcupado(id);
    await supabase.functions.invoke("avaliar-renovacao", { body: { action: "rejeitar", id, observacao } });
    await qc.invalidateQueries({ queryKey: ["renovacoes-pendentes"] });
    setOcupado(null);
  }

  async function verComprovante(id: string) {
    const { data } = await supabase.functions.invoke("avaliar-renovacao", { body: { action: "url", id } });
    if (data?.url) window.open(data.url, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-slate-700" />
        <h1 className="text-lg font-bold text-slate-900">Autorizações pendentes</h1>
      </div>
      <p className="text-sm text-slate-500">
        Analise o comprovante de vínculo. Ao aprovar, a carteirinha do aluno é liberada para o semestre.
      </p>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">
          Nenhuma autorização pendente.
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((r) => {
            const a = alunoDe(r);
            return (
              <div key={r.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{a?.nome ?? "—"}</p>
                    <p className="text-xs text-slate-500">
                      {a?.curso ?? "curso não informado"} · semestre {r.semestre}
                    </p>
                    {r.comprovanteUrl && (
                      <button onClick={() => verComprovante(r.id)} className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                        Ver comprovante <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => aprovar(r.id)}
                      disabled={ocupado === r.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </button>
                    <button
                      onClick={() => rejeitar(r.id)}
                      disabled={ocupado === r.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
