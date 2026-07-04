import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, type Papel } from "./auth/AuthProvider";
import Login from "./routes/Login";
import Cadastro from "./routes/Cadastro";
import DefinirSenha from "./routes/DefinirSenha";
import Verificacao from "./routes/Verificacao";
import PortalLayout from "./portal/PortalLayout";
import Carteirinha from "./portal/Carteirinha";
import Reserva from "./portal/Reserva";
import Documentos from "./portal/Documentos";
import Perfil from "./portal/Perfil";
import PainelLayout from "./painel/PainelLayout";
import Metricas from "./painel/Metricas";
import Autorizacoes from "./painel/Autorizacoes";
import Alunos from "./painel/Alunos";
import Rotas from "./painel/Rotas";
import Frota from "./painel/Frota";
import Calendario from "./painel/Calendario";
import Auditoria from "./painel/Auditoria";
import Template from "./painel/Template";
import Embarque from "./painel/Embarque";
import Transporte from "./painel/Transporte";
import Funcionarios from "./painel/Funcionarios";
import MonitorScreen from "./painel/MonitorScreen";
import DonoScreen from "./painel/DonoScreen";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
      Carregando…
    </div>
  );
}

const HOME_POR_PAPEL: Record<Papel, string> = {
  DONO: "/dono",
  ADMIN: "/painel",
  FISCAL: "/monitor",
  ALUNO: "/portal",
};

// "/" → despacha para a área do papel
function Home() {
  const { perfil, carregando } = useAuth();
  if (carregando) return <Splash />;
  if (!perfil) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_POR_PAPEL[perfil.papel]} replace />;
}

function Protegido({ papeis, permissao, children }: { papeis: Papel[]; permissao?: string; children: ReactNode }) {
  const { perfil, carregando, pode } = useAuth();
  if (carregando) return <Splash />;
  if (!perfil) return <Navigate to="/login" replace />;
  // libera por papel OU por permissão específica (ex.: aluno-monitor com ESCANEAR_EMBARQUE)
  if (!papeis.includes(perfil.papel) && !(permissao && pode(permissao))) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/definir-senha" element={<DefinirSenha />} />
      <Route path="/v/:token" element={<Verificacao />} />
      <Route path="/" element={<Home />} />
      <Route
        path="/dono/*"
        element={
          <Protegido papeis={["DONO"]}>
            <DonoScreen />
          </Protegido>
        }
      />
      <Route
        path="/painel"
        element={
          <Protegido papeis={["ADMIN", "DONO"]}>
            <PainelLayout />
          </Protegido>
        }
      >
        <Route index element={<Metricas />} />
        <Route path="autorizacoes" element={<Autorizacoes />} />
        <Route path="alunos" element={<Alunos />} />
        <Route path="rotas" element={<Rotas />} />
        <Route path="frota" element={<Frota />} />
        <Route path="template" element={<Template />} />
        <Route path="embarque" element={<Embarque />} />
        <Route path="transporte" element={<Transporte />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="funcionarios" element={<Funcionarios />} />
      </Route>
      <Route
        path="/monitor/*"
        element={
          <Protegido papeis={["FISCAL", "ADMIN", "DONO"]} permissao="ESCANEAR_EMBARQUE">
            <MonitorScreen />
          </Protegido>
        }
      />
      <Route
        path="/portal"
        element={
          <Protegido papeis={["ALUNO"]}>
            <PortalLayout />
          </Protegido>
        }
      >
        <Route index element={<Carteirinha />} />
        <Route path="reserva" element={<Reserva />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="perfil" element={<Perfil />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
