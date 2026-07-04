import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatarValidade } from "../lib/carteirinha";

type Situacao = "VALIDA" | "EXPIRADA" | "DESATUALIZADA" | "NAO_AUTORIZADA" | "INVALIDO";
interface Resultado {
  situacao: Situacao;
  nome?: string; faculdade?: string; curso?: string | null; matricula?: string | null;
  fotoUrl?: string | null; validade?: string | null;
}

const ESTILO: Record<Situacao, { cor: string; texto: string }> = {
  VALIDA: { cor: "bg-emerald-600", texto: "CARTEIRINHA VÁLIDA" },
  EXPIRADA: { cor: "bg-red-600", texto: "CARTEIRINHA EXPIRADA" },
  DESATUALIZADA: { cor: "bg-amber-600", texto: "VERSÃO DESATUALIZADA" },
  NAO_AUTORIZADA: { cor: "bg-amber-600", texto: "AGUARDANDO AUTORIZAÇÃO" },
  INVALIDO: { cor: "bg-gray-700", texto: "QR INVÁLIDO" },
};

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verificar-carteirinha`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function Verificacao() {
  const { token } = useParams();
  const [r, setR] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ token }) })
      .then((res) => res.json())
      .then((data) => { if (ativo) { setR(data); setCarregando(false); } })
      .catch(() => { if (ativo) { setR({ situacao: "INVALIDO" }); setCarregando(false); } });
    return () => { ativo = false; };
  }, [token]);

  if (carregando) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-400">Verificando…</main>;
  }

  const res = r ?? { situacao: "INVALIDO" as Situacao };
  const estilo = ESTILO[res.situacao];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-6">
      <div className={`w-full max-w-sm rounded-2xl ${estilo.cor} p-6 text-center text-white`}>
        <p className="text-lg font-bold tracking-wide">{estilo.texto}</p>
      </div>

      {res.situacao !== "INVALIDO" && (
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-4">
            {res.fotoUrl ? (
              <img src={res.fotoUrl} alt={res.nome} className="h-20 w-16 rounded object-cover ring-1 ring-gray-200" />
            ) : (
              <div className="flex h-20 w-16 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">sem foto</div>
            )}
            <div>
              <p className="font-semibold">{res.nome}</p>
              <p className="text-sm text-gray-500">{res.faculdade}</p>
              {res.curso && <p className="text-sm text-gray-500">{res.curso}</p>}
            </div>
          </div>
          <dl className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
            {res.matricula && (
              <div className="flex justify-between"><dt className="text-gray-500">Matrícula</dt><dd>{res.matricula}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-gray-500">Validade</dt><dd>{formatarValidade(res.validade ?? null)}</dd></div>
          </dl>
        </div>
      )}

      <p className="text-xs text-gray-400">SYSBUS · verificação oficial</p>
    </main>
  );
}
