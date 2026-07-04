// Edge Function (Deno) — gestão de aluno pela secretaria (LGPD). Guardada por gestor
// (ADMIN/DONO da secretaria do aluno). Ações (JSON):
//  - editar    : atualiza dados do aluno (+ sincroniza Usuario.nome).
//  - autorizar : autorização MANUAL pela secretaria (aluno cadastrado direto, sem renovação).
//                Libera a carteirinha do período letivo vigente (validade + versao+1 + novo qrToken).
//  - desligar  : SOFT DELETE (status=DESLIGADO + bane o login). Reversível. Mantém histórico.
//  - reativar  : volta status=ATIVO + reabilita login.
//  - anonimizar: DIREITO AO ESQUECIMENTO (LGPD art. 18) — apaga PII de forma irreversível
//                (foto, documentos, comprovantes, nome, cpf, e-mail) e remove a conta.
// Toda ação grava LogAuditoria.
//
// Deploy: npx supabase functions deploy gerir-aluno --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";

const AUTH_SECRET = Deno.env.get("AUTH_SECRET")!;

// fim do semestre vigente (fallback quando não há PeriodoLetivo configurado): 1º→30/jun, 2º→31/dez (BRT).
function fimSemestreAtual(): { validade: Date; label: string } {
  const agora = new Date();
  const ano = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Recife", year: "numeric" }).format(agora));
  const mes = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Recife", month: "numeric" }).format(agora));
  const primeiro = mes <= 6;
  return {
    validade: new Date(primeiro ? `${ano}-06-30T23:59:59-03:00` : `${ano}-12-31T23:59:59-03:00`),
    label: `${ano}.${primeiro ? 1 : 2}`,
  };
}

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// deno-lint-ignore no-explicit-any
type DB = any;
const um = (x: unknown) => (Array.isArray(x) ? x[0] ?? null : x ?? null);

function nomeArquivoPublico(url: string): string | null {
  const m = /\/public\/midia\/(.+)$/.exec(url);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const asUser = createClient(URL_, ANON, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "não autenticado" }, 401);

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller } = await db.from("Usuario").select("id, nome, papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const action = b.action ?? "";
  const alunoId = String(b.alunoId ?? "");
  if (!alunoId) return json({ error: "alunoId ausente" }, 400);

  const { data: aluno } = await db.from("Aluno")
    .select(`id, usuarioId, nome, secretariaId, fotoUrl, usuario:Usuario ( authUserId )`).eq("id", alunoId).maybeSingle();
  if (!aluno) return json({ error: "aluno não encontrado" }, 404);
  const podeGerir = caller.papel === "DONO" || (aluno.secretariaId && aluno.secretariaId === caller.secretariaId);
  if (!podeGerir) return json({ error: "sem permissão nesta secretaria" }, 403);
  const authUserId = (um(aluno.usuario) as { authUserId: string | null } | null)?.authUserId ?? null;

  async function audit(acao: string, descricao: string) {
    await db.from("LogAuditoria").insert({
      id: crypto.randomUUID(), usuarioId: caller.id, usuarioNome: caller.nome, papel: caller.papel,
      acao, descricao, entidade: "Aluno", entidadeId: alunoId, secretariaId: aluno.secretariaId,
    });
  }

  if (action === "editar") {
    const patch: Record<string, unknown> = {
      nome: String(b.nome ?? aluno.nome).trim(),
      faculdade: (b.faculdade ?? "").trim() || null,
      curso: (b.curso ?? "").trim() || null,
      matricula: (b.matricula ?? "").trim() || null,
    };
    if (b.destinoId) patch.destinoId = b.destinoId;
    if (b.dataNascimento !== undefined) patch.dataNascimento = b.dataNascimento ? `${b.dataNascimento}T12:00:00-03:00` : null;
    await db.from("Aluno").update(patch).eq("id", alunoId);
    if (aluno.usuarioId) await db.from("Usuario").update({ nome: patch.nome }).eq("id", aluno.usuarioId);
    await audit("ALUNO_EDITADO", `Editou os dados do aluno ${patch.nome}`);
    return json({ ok: true });
  }

  if (action === "autorizar") {
    // carteirinha do aluno (cria se ainda não existir)
    let { data: cart } = await db.from("Carteirinha").select("id, versao").eq("alunoId", alunoId).maybeSingle();
    if (!cart) {
      const novoId = crypto.randomUUID();
      await db.from("Carteirinha").insert({ id: novoId, alunoId, versao: 1 });
      cart = { id: novoId, versao: 1 };
    }
    // validade = fim do período letivo configurado; senão, fim do semestre vigente
    const { data: periodo } = await db.from("PeriodoLetivo").select("label, validadeAte").eq("secretariaId", aluno.secretariaId).maybeSingle();
    const fb = fimSemestreAtual();
    const validade = periodo?.validadeAte ? new Date(periodo.validadeAte) : fb.validade;
    const label = periodo?.label ?? fb.label;
    const novaVersao = (cart.versao ?? 1) + 1;
    const novoToken = await new SignJWT({ v: novaVersao })
      .setProtectedHeader({ alg: "HS256" }).setSubject(cart.id).setIssuedAt()
      .sign(new TextEncoder().encode(AUTH_SECRET));
    await db.from("Carteirinha").update({ validade: validade.toISOString(), versao: novaVersao, qrToken: novoToken }).eq("id", cart.id);
    await audit("AUTORIZACAO_MANUAL", `Autorizou manualmente ${aluno.nome} (período ${label}, validade ${validade.toLocaleDateString("pt-BR", { timeZone: "America/Recife" })})`);
    return json({ ok: true, validade: validade.toISOString() });
  }

  if (action === "definir-monitor") {
    if (!aluno.usuarioId) return json({ error: "aluno sem conta de acesso" }, 409);
    const ativo = String(b.ativo) === "true";
    const { data: u } = await db.from("Usuario").select("permissoes").eq("id", aluno.usuarioId).maybeSingle();
    const set = new Set<string>(Array.isArray(u?.permissoes) ? u.permissoes : []);
    if (ativo) { set.add("ESCANEAR_EMBARQUE"); set.add("VER_EMBARQUE"); }
    else { set.delete("ESCANEAR_EMBARQUE"); set.delete("VER_EMBARQUE"); }
    await db.from("Usuario").update({ permissoes: [...set] }).eq("id", aluno.usuarioId);
    await audit(ativo ? "ALUNO_MONITOR_ATIVADO" : "ALUNO_MONITOR_DESATIVADO", `${ativo ? "Definiu" : "Removeu"} ${aluno.nome} como monitor`);
    return json({ ok: true });
  }

  if (action === "desligar") {
    await db.from("Aluno").update({ status: "DESLIGADO" }).eq("id", alunoId);
    if (authUserId) await db.auth.admin.updateUserById(authUserId, { ban_duration: "876000h" }); // ~100 anos
    await audit("ALUNO_DESLIGADO", `Desligou o aluno ${aluno.nome} (acesso revogado)`);
    return json({ ok: true });
  }

  if (action === "reativar") {
    await db.from("Aluno").update({ status: "ATIVO" }).eq("id", alunoId);
    if (authUserId) await db.auth.admin.updateUserById(authUserId, { ban_duration: "none" });
    await audit("ALUNO_REATIVADO", `Reativou o aluno ${aluno.nome}`);
    return json({ ok: true });
  }

  if (action === "anonimizar") {
    // 1) apaga arquivos (foto pública + documentos/comprovantes privados)
    const remover: Record<string, string[]> = { midia: [], documentos: [] };
    if (aluno.fotoUrl) { const n = nomeArquivoPublico(aluno.fotoUrl); if (n) remover.midia.push(n); }
    const { data: docs } = await db.from("DocumentoEnviado").select("arquivoUrl").eq("alunoId", alunoId);
    const { data: renovs } = await db.from("Renovacao").select("comprovanteUrl").eq("alunoId", alunoId);
    for (const d of docs ?? []) if (String(d.arquivoUrl).startsWith("priv:")) remover.documentos.push(String(d.arquivoUrl).slice(5));
    for (const r of renovs ?? []) if (r.comprovanteUrl && String(r.comprovanteUrl).startsWith("priv:")) remover.documentos.push(String(r.comprovanteUrl).slice(5));
    if (remover.midia.length) await db.storage.from("midia").remove(remover.midia);
    if (remover.documentos.length) await db.storage.from("documentos").remove(remover.documentos);

    // 2) remove registros de PII (documentos/renovações) e a conta de acesso
    await db.from("DocumentoEnviado").delete().eq("alunoId", alunoId);
    await db.from("Renovacao").delete().eq("alunoId", alunoId);
    if (authUserId) await db.auth.admin.deleteUser(authUserId).catch(() => {});

    // 3) anonimiza o que resta (mantém a linha p/ integridade referencial de viagens/embarques,
    //    mas sem dado pessoal — dado anonimizado deixa de ser dado pessoal pela LGPD)
    const marca = alunoId.replace(/-/g, "").slice(0, 12);
    await db.from("Aluno").update({
      nome: "[Removido]", cpf: `anon-${marca}`, matricula: null, curso: null, faculdade: null,
      dataNascimento: null, fotoUrl: null, status: "DESLIGADO",
    }).eq("id", alunoId);
    if (aluno.usuarioId) await db.from("Usuario").update({
      nome: "[Removido]", email: `anon-${marca}@removido.local`, authUserId: null,
    }).eq("id", aluno.usuarioId);

    await audit("ALUNO_ANONIMIZADO", `Anonimizou o aluno (id ${alunoId}) — direito ao esquecimento (LGPD)`);
    return json({ ok: true });
  }

  return json({ error: "ação inválida" }, 400);
});
