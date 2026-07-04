import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Radio, ClipboardCheck, Users, Route as RouteIcon, Bus, BusFront,
  IdCard, CalendarDays, ScrollText, UserCog, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

type Item = { to: string; end?: boolean; icon: typeof Bus; label: string; perm: string | null };
const GRUPOS: { titulo: string | null; itens: Item[] }[] = [
  { titulo: null, itens: [{ to: "/painel", end: true, icon: LayoutDashboard, label: "Visão geral", perm: null }] },
  {
    titulo: "Transporte",
    itens: [
      { to: "/painel/transporte", icon: Radio, label: "Viagem ao vivo", perm: "VER_TRANSPORTE" },
      { to: "/painel/embarque", icon: BusFront, label: "Embarque", perm: "VER_EMBARQUE" },
      { to: "/painel/rotas", icon: RouteIcon, label: "Rotas", perm: "GERIR_ROTAS" },
      { to: "/painel/frota", icon: Bus, label: "Frota", perm: "GERIR_FROTA" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { to: "/painel/autorizacoes", icon: ClipboardCheck, label: "Autorizações", perm: "APROVAR_DOCUMENTOS" },
      { to: "/painel/alunos", icon: Users, label: "Alunos", perm: "GERIR_ALUNOS" },
      { to: "/painel/template", icon: IdCard, label: "Carteirinha", perm: "GERIR_TEMPLATE" },
      { to: "/painel/calendario", icon: CalendarDays, label: "Calendário", perm: "GERIR_CALENDARIO" },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      { to: "/painel/auditoria", icon: ScrollText, label: "Auditoria", perm: "VER_AUDITORIA" },
      { to: "/painel/funcionarios", icon: UserCog, label: "Funcionários", perm: "GERIR_FUNCIONARIOS" },
    ],
  },
];

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
  }`;

export default function PainelLayout() {
  const { perfil, sair, pode } = useAuth();
  const [aberto, setAberto] = useState(false);
  const grupos = GRUPOS
    .map((g) => ({ ...g, itens: g.itens.filter((i) => !i.perm || pode(i.perm)) }))
    .filter((g) => g.itens.length > 0);
  const iniciais = (perfil?.nome ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* backdrop do drawer (só < lg, quando aberto) */}
      {aberto && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setAberto(false)} />}

      {/* SIDEBAR: fixo/drawer no mobile, estático no lg+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-brand-900 transition-transform duration-200 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 ${
          aberto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white"><Bus className="h-5 w-5" /></div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">SYSBUS</p>
              <p className="text-[11px] text-slate-400">Secretaria</p>
            </div>
          </div>
          <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? i}>
              {g.titulo && <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{g.titulo}</p>}
              <div className="space-y-0.5">
                {g.itens.map(({ to, end, icon: Icon, label }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setAberto(false)} className={linkCls}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 px-1 pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{iniciais}</div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium text-white">{perfil?.nome}</p>
              <p className="truncate text-[11px] text-slate-400">{perfil?.email}</p>
            </div>
          </div>
          <button onClick={() => sair()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* barra superior com HAMBURGER (< lg) */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setAberto(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <p className="text-sm font-bold text-slate-900">SYSBUS · Secretaria</p>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
