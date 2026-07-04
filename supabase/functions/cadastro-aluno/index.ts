// Edge Function (Deno) — AUTO-CADASTRO do aluno (fluxo 1: o aluno digita a própria
// senha, sem e-mail de token). Espelha a server action antiga src/app/cadastro/actions.ts.
//
// Recebe multipart/form-data: nome,email,senha,cpf,destinoId (+ opcionais) + arquivos
// foto (opcional) e comprovante (obrigatório). Faz: uploads (Storage), cria identidade
// no Supabase Auth (email já confirmado), e insere Usuario+Aluno+Carteirinha(QR assinado)
// +Renovacao(PENDENTE) via service role. Retorna { email } p/ o front logar em seguida.
//
// Deploy: npx supabase functions deploy cadastro-aluno --use-api --no-verify-jwt --project-ref mtumvzzvwankdppebhle
// Secrets usados: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), AUTH_SECRET (p/ QR).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";
import { lerArquivoValidado } from "../_shared/upload.ts";
import { cpfValido } from "../_shared/validacao.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTH_SECRET = Deno.env.get("AUTH_SECRET")!;
const BUCKET_PUB = "midia";
const BUCKET_PRIV = "documentos";
const PREFIXO_PRIV = "priv:";

const EXT_OK = new Set(["png", "jpg", "jpeg", "webp", "pdf"]);

// Semestre atual "2026.1"/"2026.2" (espelha semestreAtual()).
function semestreAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`;
}

// deno-lint-ignore no-explicit-any
async function upload(db: any, file: File, prefixo: string, privado: boolean): Promise<string> {
  const val = await lerArquivoValidado(file, EXT_OK); // tamanho + extensão + magic bytes
  if (!val.ok) throw new Error(val.erro);
  const nome = `${prefixo}${crypto.randomUUID()}.${val.ext}`;
  const bucket = privado ? BUCKET_PRIV : BUCKET_PUB;
  const { error } = await db.storage.from(bucket).upload(nome, val.bytes, {
    contentType: val.contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage: ${error.message}`);
  if (privado) return `${PREFIXO_PRIV}${nome}`;
  return db.storage.from(BUCKET_PUB).getPublicUrl(nome).data.publicUrl;
}

async function qrToken(cid: string, versao: number): Promise<string> {
  return await new SignJWT({ v: versao })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(cid)
    .setIssuedAt()
    .sign(new TextEncoder().encode(AUTH_SECRET));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "envie multipart/form-data" }, 400);
  }
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const nome = s("nome");
  const email = s("email").toLowerCase();
  const senha = s("senha");
  const cpf = s("cpf");
  const destinoId = s("destinoId");
  const faculdade = s("faculdade") || null;
  const curso = s("curso") || null;
  const matricula = s("matricula") || null;
  const dataNascimento = s("dataNascimento") || null;

  if (nome.length < 3) return json({ error: "Informe seu nome completo." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
  if (senha.length < 6) return json({ error: "A senha precisa ter ao menos 6 caracteres." }, 400);
  if (!cpfValido(cpf)) return json({ error: "CPF inválido." }, 400);
  if (!destinoId) return json({ error: "Selecione a cidade/rota." }, 400);

  const comprovante = form.get("comprovante");
  if (!(comprovante instanceof File) || comprovante.size === 0) {
    return json({ error: "Anexe o comprovante de vínculo (PDF ou foto)." }, 400);
  }
  const foto = form.get("foto");

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

  // unicidade
  const { data: jaEmail } = await db.from("Usuario").select("id").eq("email", email).maybeSingle();
  if (jaEmail) return json({ error: "Já existe uma conta com este e-mail." }, 409);
  const { data: jaCpf } = await db.from("Aluno").select("id").eq("cpf", cpf).maybeSingle();
  if (jaCpf) return json({ error: "Já existe um aluno com este CPF." }, 409);

  try {
    const [fotoUrl, comprovanteUrl] = await Promise.all([
      foto instanceof File && foto.size > 0 ? upload(db, foto, "foto-", false) : Promise.resolve(null),
      upload(db, comprovante, "comprovante-", true),
    ]);

    // identidade no Supabase Auth (email confirmado — sem verificação por e-mail)
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email, password: senha, email_confirm: true,
    });
    if (authErr || !authData.user) return json({ error: "Não foi possível criar o acesso." }, 500);
    const authUserId = authData.user.id;

    // tenant: o aluno herda a secretaria da rota (Destino) que escolheu
    const { data: dest } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
    const secretariaId = dest?.secretariaId ?? null;

    const usuarioId = crypto.randomUUID();
    const alunoId = crypto.randomUUID();
    const cartId = crypto.randomUUID();

    const ins = async (tabela: string, row: Record<string, unknown>) => {
      const { error } = await db.from(tabela).insert(row);
      if (error) throw new Error(`${tabela}: ${error.message}`);
    };

    await ins("Usuario", {
      id: usuarioId, nome, email, senhaHash: "__supabase_auth__", papel: "ALUNO", authUserId, secretariaId,
    });
    await ins("Aluno", {
      id: alunoId, usuarioId, nome, cpf, faculdade, curso, matricula, destinoId, fotoUrl, secretariaId,
      dataNascimento: dataNascimento ? `${dataNascimento}T12:00:00-03:00` : null,
    });
    await ins("Carteirinha", {
      id: cartId, alunoId, versao: 1, validade: null, qrToken: await qrToken(cartId, 1),
    });
    await ins("Renovacao", {
      id: crypto.randomUUID(), alunoId, semestre: semestreAtual(), comprovanteUrl, status: "PENDENTE",
    });

    return json({ email });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao cadastrar." }, 500);
  }
});
