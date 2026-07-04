import { NavLink, Outlet, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CalendarCheck, FileText, User, LogOut, ScanLine, WifiOff, Bus } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useOnline } from "../lib/offline";
import { supabase } from "../lib/supabase";

const TABS = [
  { to: "/portal", end: true, icon: CreditCard, label: "Carteirinha" },
  { to: "/portal/reserva", end: false, icon: CalendarCheck, label: "Reserva" },
  { to: "/portal/documentos", end: false, icon: FileText, label: "Documentos" },
  { to: "/portal/perfil", end: false, icon: User, label: "Perfil" },
];

export default function PortalLayout() {
  const { perfil, sair, pode } = useAuth();
  const online = useOnline();

  // marca da secretaria (logo enviada pela secretaria). Sem logo → ícone neutro.
  const { data: sec } = useQuery({
    queryKey: ["secretaria-marca", perfil?.secretariaId],
    enabled: Boolean(perfil?.secretariaId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("Secretaria").select("nome, logoUrl").eq("id", perfil!.secretariaId!).maybeSingle();
      return (data as { nome: string; logoUrl: string | null } | null) ?? null;
    },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50">
      {/* header: 3 colunas → logo centralizada no mobile, SYSBUS discreto */}
      <header className="grid grid-cols-[1fr_auto_1fr] items-center bg-brand-900 px-3 py-2.5">
        <div className="justify-self-start">
          {!online && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-amber-300" title="Sem internet — o app continua funcionando">
              <WifiOff className="h-3.5 w-3.5" /> offline
            </span>
          )}
        </div>

        <div className="flex flex-col items-center justify-self-center">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
            {sec?.logoUrl
              ? <img src={sec.logoUrl} alt={sec?.nome ?? ""} className="h-full w-full object-contain" />
              : <Bus className="h-5 w-5 text-white/90" />}
          </div>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">SYSBUS</span>
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          {pode("ESCANEAR_EMBARQUE") && (
            <Link to="/monitor" className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm text-white hover:bg-white/20">
              <ScanLine className="h-4 w-4" /> <span className="hidden sm:inline">Monitor</span>
            </Link>
          )}
          <button onClick={() => sair()} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white" title="Sair">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-28">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg border-t border-slate-200 bg-white">
        {TABS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? "text-brand-600" : "text-slate-400"}`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
