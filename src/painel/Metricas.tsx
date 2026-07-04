import { useQuery } from "@tanstack/react-query";
import { Users, ShieldCheck, ClipboardList, Route as RouteIcon, Bus, CalendarCheck, LogIn } from "lucide-react";
import { supabase } from "../lib/supabase";

interface M {
  totalAlunos: number; autorizados: number; pendentesAut: number;
  rotas: number; onibus: number; reservasHoje: number; embarquesHoje: number;
}

export default function Metricas() {
  const { data, isLoading } = useQuery({
    queryKey: ["metricas"],
    queryFn: async (): Promise<M | null> => {
      const { data } = await supabase.functions.invoke("metricas", { body: {} });
      return (data as M) ?? null;
    },
  });

  const cards = [
    { icon: Users, label: "Alunos", valor: data?.totalAlunos, cor: "text-slate-700" },
    { icon: ShieldCheck, label: "Autorizados", valor: data?.autorizados, cor: "text-emerald-600" },
    { icon: ClipboardList, label: "Autorização pendente", valor: data?.pendentesAut, cor: "text-amber-600" },
    { icon: RouteIcon, label: "Rotas", valor: data?.rotas, cor: "text-slate-700" },
    { icon: Bus, label: "Ônibus", valor: data?.onibus, cor: "text-slate-700" },
    { icon: CalendarCheck, label: "Reservas hoje", valor: data?.reservasHoje, cor: "text-brand-600" },
    { icon: LogIn, label: "Embarques hoje", valor: data?.embarquesHoje, cor: "text-brand-600" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Visão geral</h1>
      {isLoading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <c.icon className={`h-5 w-5 ${c.cor}`} />
              <p className="mt-2 text-2xl font-bold text-slate-900">{c.valor ?? "—"}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
