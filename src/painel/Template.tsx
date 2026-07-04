import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IdCard } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import TemplateEditor, { type PayloadSalvar, type TemplateInicial } from "../components/TemplateEditor";
import type { CampoCarteirinha } from "../lib/carteirinha";

interface Rota { id: string; nome: string }

export default function Template() {
  const { perfil } = useAuth();
  const [rotaId, setRotaId] = useState("");

  const { data: rotas } = useQuery({
    queryKey: ["template-rotas", perfil?.secretariaId],
    queryFn: async () => {
      let q = supabase.from("Destino").select("id,nome").order("nome");
      if (perfil?.secretariaId) q = q.eq("secretariaId", perfil.secretariaId);
      const { data } = await q;
      return (data as Rota[]) ?? [];
    },
  });

  useEffect(() => {
    if (!rotaId && rotas && rotas.length > 0) setRotaId(rotas[0].id);
  }, [rotas, rotaId]);

  const { data: inicial, isFetching } = useQuery({
    queryKey: ["template-modelo", rotaId],
    enabled: Boolean(rotaId),
    queryFn: async (): Promise<TemplateInicial | null> => {
      const { data } = await supabase.from("ModeloCarteirinha")
        .select("campos, largura, altura, arteFrenteUrl, arteVersoUrl").eq("destinoId", rotaId).maybeSingle();
      if (!data) return { arteUrl: null, arteVersoUrl: null, larguraBase: 1012, alturaBase: 638, campos: [] };
      return {
        arteUrl: data.arteFrenteUrl ?? null,
        arteVersoUrl: data.arteVersoUrl ?? null,
        larguraBase: data.largura ?? 1012,
        alturaBase: data.altura ?? 638,
        campos: (data.campos as CampoCarteirinha[]) ?? [],
      };
    },
  });

  async function salvar(p: PayloadSalvar): Promise<{ ok: boolean; erro?: string }> {
    const fd = new FormData();
    fd.set("destinoId", rotaId);
    fd.set("larguraBase", String(p.larguraBase));
    fd.set("alturaBase", String(p.alturaBase));
    fd.set("campos", JSON.stringify(p.campos));
    if (p.arteFile) fd.set("arte", p.arteFile);
    else if (p.arteUrlExistente) fd.set("arteUrlExistente", p.arteUrlExistente);
    if (p.arteVersoFile) fd.set("arteVerso", p.arteVersoFile);
    else if (p.arteVersoUrlExistente) fd.set("arteVersoUrlExistente", p.arteVersoUrlExistente);
    const { data, error } = await supabase.functions.invoke("salvar-template", { body: fd });
    if (error || !data?.ok) {
      let erro = "Erro ao salvar.";
      const ctx = (error as { context?: Response })?.context;
      try { if (ctx) erro = (await ctx.json()).error ?? erro; } catch { /* */ }
      return { ok: false, erro };
    }
    return { ok: true };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IdCard className="h-5 w-5 text-slate-700" />
          <h1 className="text-lg font-bold text-slate-900">Template da carteirinha</h1>
        </div>
        <select value={rotaId} onChange={(e) => setRotaId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          {(rotas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
        </select>
      </div>
      <p className="text-sm text-slate-500">Desenhe o layout da carteirinha desta rota. O mesmo modelo vale para todos os alunos dela.</p>

      {isFetching || !inicial ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando template…</p>
      ) : (
        <TemplateEditor key={rotaId} inicial={inicial} onSalvar={salvar} />
      )}
    </div>
  );
}
