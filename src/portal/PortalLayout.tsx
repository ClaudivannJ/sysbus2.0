import { NavLink, Outlet, Link } from "react-router-dom";
import { CreditCard, CalendarCheck, FileText, User, LogOut, ScanLine, WifiOff } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useOnline } from "../lib/offline";

const TABS = [
  { to: "/portal", end: true, icon: CreditCard, label: "Carteirinha" },
  { to: "/portal/reserva", end: false, icon: CalendarCheck, label: "Reserva" },
  { to: "/portal/documentos", end: false, icon: FileText, label: "Documentos" },
  { to: "/portal/perfil", end: false, icon: User, label: "Perfil" },
];

export default function PortalLayout() {
  const { perfil, sair, pode } = useAuth();
  const online = useOnline();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-slate-50">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <img src="/itaiba-logo.png" alt="" className="h-6 w-6 object-contain" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">SYSBUS Itaíba</p>
            <p className="text-[11px] text-slate-300">{perfil?.nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!online && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-amber-300" title="Sem internet — o app continua funcionando">
              <WifiOff className="h-3.5 w-3.5" /> offline
            </span>
          )}
          {pode("ESCANEAR_EMBARQUE") && (
            <Link
              to="/monitor"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm text-white hover:bg-white/20"
            >
              <ScanLine className="h-4 w-4" />
              Monitor
            </Link>
          )}
          <button
            onClick={() => sair()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-slate-200 bg-white">
        {TABS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-brand-600" : "text-slate-400"
              }`
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
