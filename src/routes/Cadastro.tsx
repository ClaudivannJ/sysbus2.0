import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import Dropzone from "../components/Dropzone";

interface Destino {
  id: string;
  nome: string;
}

// Comprime imagens NO NAVEGADOR antes de enviar (foto de celular tem vários MB).
// Reduz o upload de ~5MB para ~200KB → rápido no 4G. PDF passa direto.
async function comprimir(file: File, max = 1600, q = 0.72): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cadastro-aluno`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function Cadastro() {
  const navigate = useNavigate();
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [comprovante, setComprovante] = useState<File | null>(null);

  useEffect(() => {
    supabase
      .from("Destino")
      .select("id,nome")
      .order("nome")
      .then(({ data }) => setDestinos((data as Destino[]) ?? []));
  }, []);

  async function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      if (!comprovante) { setErro("Anexe o comprovante de vínculo (PDF ou foto)."); setEnviando(false); return; }
      if (foto) fd.set("foto", await comprimir(foto));
      fd.set("comprovante", await comprimir(comprovante));

      const email = String(fd.get("email") ?? "").trim().toLowerCase();
      const senha = String(fd.get("senha") ?? "");

      const r = await fetch(FN, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Não foi possível concluir o cadastro.");

      // entra automaticamente e vai para o portal (verá "aguardando autorização")
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      navigate("/portal", { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setEnviando(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-6 flex items-center gap-3">
          <img src="/sysbus-logo.png" alt="SYSBUS" className="h-10 w-auto object-contain rounded-xl" />
          <div className="leading-tight">
            <p className="font-bold text-slate-900">Criar conta de estudante</p>
            <p className="text-xs text-slate-500">Transporte universitário</p>
          </div>
        </div>

        <form
          onSubmit={aoEnviar}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Nome completo *</span>
            <input name="nome" required className={inputCls} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">CPF *</span>
              <input name="cpf" required inputMode="numeric" placeholder="000.000.000-00" className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Nascimento</span>
              <input name="dataNascimento" type="date" className={inputCls} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail *</span>
            <input name="email" type="email" required autoCapitalize="none" className={inputCls} />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Senha * (mín. 6)</span>
            <input name="senha" type="password" required minLength={6} className={inputCls} />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Cidade / rota *</span>
            <select name="destinoId" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Selecione…
              </option>
              {destinos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Faculdade</span>
              <input name="faculdade" className={inputCls} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Curso</span>
              <input name="curso" className={inputCls} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Matrícula</span>
            <input name="matricula" className={inputCls} />
          </label>

          <div className="text-sm">
            <span className="font-medium text-slate-700">Foto (rosto, para a carteirinha)</span>
            <div className="mt-1">
              <Dropzone accept="image/*" titulo="Enviar foto" sub={foto ? undefined : "PNG ou JPG"} onFile={setFoto} />
            </div>
          </div>

          <div className="text-sm">
            <span className="font-medium text-slate-700">Comprovante de vínculo *</span>
            <p className="mt-0.5 text-xs text-slate-400">Declaração/matrícula que a secretaria vai analisar para autorizar seu semestre.</p>
            <div className="mt-1">
              <Dropzone accept="image/*,application/pdf" titulo="Enviar comprovante" sub="Foto ou PDF" onFile={setComprovante} />
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand-800 py-2.5 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
          >
            {enviando ? "Enviando…" : "Criar conta"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
