import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import Dropzone from "../components/Dropzone";

interface Destino { id: string; nome: string }
interface DadosAluno {
  nome: string; faculdade: string | null; curso: string | null; matricula: string | null;
  destinoId: string | null; dataNascimento: string | null; fotoUrl: string | null;
}

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
    return blob ? new File([blob], "foto.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

const inputCls = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function Perfil() {
  const { perfil } = useAuth();
  const [dados, setDados] = useState<DadosAluno | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  // senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [msgSenha, setMsgSenha] = useState<{ tom: "ok" | "erro"; texto: string } | null>(null);
  const [trocando, setTrocando] = useState(false);

  useEffect(() => {
    if (!perfil) return;
    supabase.from("Aluno")
      .select("nome,faculdade,curso,matricula,destinoId,dataNascimento,fotoUrl")
      .eq("usuarioId", perfil.id).maybeSingle()
      .then(({ data }) => setDados((data as DadosAluno) ?? null));
    supabase.from("Destino").select("id,nome").order("nome").then(({ data }) => setDestinos((data as Destino[]) ?? []));
  }, [perfil]);

  async function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setSalvando(true);
    try {
      const fd = new FormData(e.currentTarget);
      if (foto) fd.set("foto", await comprimir(foto));
      const { data, error } = await supabase.functions.invoke("perfil-aluno", { body: fd });
      if (error || !data?.ok) throw new Error();
      setMsg({ tom: "ok", texto: "Perfil atualizado." });
      if (data.fotoUrl) setDados((d) => (d ? { ...d, fotoUrl: data.fotoUrl } : d));
    } catch {
      setMsg({ tom: "erro", texto: "Não foi possível salvar o perfil." });
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setMsgSenha(null);
    if (novaSenha.length < 6) return setMsgSenha({ tom: "erro", texto: "A nova senha precisa ter ao menos 6 caracteres." });
    if (!perfil) return;
    setTrocando(true);
    // confirma a senha atual re-autenticando
    const { error: re } = await supabase.auth.signInWithPassword({ email: perfil.email, password: senhaAtual });
    if (re) { setTrocando(false); return setMsgSenha({ tom: "erro", texto: "Senha atual incorreta." }); }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setTrocando(false);
    if (error) return setMsgSenha({ tom: "erro", texto: "Não foi possível alterar a senha." });
    setSenhaAtual(""); setNovaSenha("");
    setMsgSenha({ tom: "ok", texto: "Senha alterada." });
  }

  if (!dados) return <p className="py-10 text-center text-sm text-slate-400">Carregando perfil…</p>;

  const nasc = dados.dataNascimento ? dados.dataNascimento.slice(0, 10) : "";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-900">Meu perfil</h1>

      <form onSubmit={salvar} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        {msg && (
          <p className={`rounded-md px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {msg.texto}
          </p>
        )}

        <div className="flex items-center gap-3">
          {dados.fotoUrl ? (
            <img src={dados.fotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">—</div>
          )}
          <div className="flex-1 text-sm">
            <span className="font-medium text-slate-700">Foto de perfil</span>
            <div className="mt-1">
              <Dropzone accept="image/*" titulo="Trocar foto" sub={foto ? undefined : "PNG ou JPG"} onFile={setFoto} />
            </div>
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Nome completo *</span>
          <input name="nome" defaultValue={dados.nome} required className={inputCls} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Faculdade</span>
            <input name="faculdade" defaultValue={dados.faculdade ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Curso</span>
            <input name="curso" defaultValue={dados.curso ?? ""} className={inputCls} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Matrícula</span>
            <input name="matricula" defaultValue={dados.matricula ?? ""} className={inputCls} />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nascimento</span>
            <input name="dataNascimento" type="date" defaultValue={nasc} className={inputCls} />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-slate-700">Cidade / rota *</span>
          <select name="destinoId" defaultValue={dados.destinoId ?? ""} required className={inputCls}>
            <option value="" disabled>Selecione…</option>
            {destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </label>

        <button type="submit" disabled={salvando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
          {salvando ? "Salvando…" : "Salvar alterações"}
        </button>
      </form>

      <form onSubmit={trocarSenha} className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-slate-800">Alterar senha</p>
        {msgSenha && (
          <p className={`rounded-md px-3 py-2 text-sm ${msgSenha.tom === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {msgSenha.texto}
          </p>
        )}
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Senha atual</span>
          <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Nova senha (mín. 6)</span>
          <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required minLength={6} className={inputCls} />
        </label>
        <button type="submit" disabled={trocando} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {trocando ? "Alterando…" : "Alterar senha"}
        </button>
      </form>
    </div>
  );
}
