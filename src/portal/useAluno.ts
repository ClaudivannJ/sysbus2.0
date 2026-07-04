import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { cacheSalvar, cacheLer } from "../lib/offline";
import type { AlunoParaCartao } from "../lib/carteirinha-render";
import type { SituacaoAutorizacao } from "../lib/autorizacao";

export interface AlunoPortal extends AlunoParaCartao {
  renovacoes: { status: "PENDENTE" | "APROVADA" | "REJEITADA" }[];
}

/** Carrega os dados do próprio aluno logado (carteirinha + template da rota + renovações).
 *  Guarda a última resposta no cache e a usa OFFLINE (a carteirinha precisa abrir sem internet). */
export function useAluno(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ["aluno", usuarioId],
    enabled: Boolean(usuarioId),
    // mostra a carteirinha do cache na hora (e continua exibindo se estiver offline)
    initialData: () => (usuarioId ? cacheLer<AlunoPortal>("aluno." + usuarioId) ?? undefined : undefined),
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<AlunoPortal | null> => {
      const { data, error } = await supabase
        .from("Aluno")
        .select(
          `nome, matricula, curso, fotoUrl, faculdade,
           destino:Destino ( modelo:ModeloCarteirinha ( campos, largura, altura, arteFrenteUrl, arteVersoUrl ) ),
           carteirinha:Carteirinha ( qrToken, validade ),
           renovacoes:Renovacao ( status )`,
        )
        .eq("usuarioId", usuarioId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      // PostgREST às vezes devolve embeds 1-1 como ARRAY. Normalizamos p/ objeto
      // (senão o status de autorização e o QR quebram para o aluno autorizado).
      const d = data as Record<string, unknown>;
      const um = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));
      d.carteirinha = um(d.carteirinha);
      d.destino = um(d.destino);
      if (d.destino) {
        (d.destino as Record<string, unknown>).modelo = um((d.destino as Record<string, unknown>).modelo);
      }
      d.renovacoes = Array.isArray(d.renovacoes) ? d.renovacoes : d.renovacoes ? [d.renovacoes] : [];
      const aluno = d as unknown as AlunoPortal;
      cacheSalvar("aluno." + usuarioId, aluno); // p/ abrir offline depois
      return aluno;
    },
  });
}

export type { SituacaoAutorizacao };
