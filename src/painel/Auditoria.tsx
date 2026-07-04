import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Log {
  id: string; usuarioNome: string; papel: string; acao: string; descricao: string; criadoEm: string;
}

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Recife", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Auditoria() {
  const { data, isLoading } = useQuery({
    queryKey: ["painel-auditoria"],
    queryFn: async () => {
      const { data } = await supabase
        .from("LogAuditoria")
        .select("id,usuarioNome,papel,acao,descricao,criadoEm")
        .order("criadoEm", { ascending: false })
        .limit(200);
      return (data as Log[]) ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-slate-700" />
        <h1 className="text-lg font-bold text-slate-900">Auditoria</h1>
      </div>
      <p className="text-sm text-slate-500">Registro imutável de ações da secretaria (aprovações, rejeições, etc.).</p>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Nenhum registro ainda.</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {data.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-24 shrink-0 text-xs text-slate-400">{quando(l.criadoEm)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{l.descricao}</p>
                  <p className="text-xs text-slate-400">{l.usuarioNome} · {l.papel} · <span className="font-mono">{l.acao}</span></p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
