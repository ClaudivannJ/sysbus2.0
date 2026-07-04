import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Papel = "DONO" | "ADMIN" | "FISCAL" | "ALUNO";

export interface Perfil {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  secretariaId: string | null;
  permissoes: string[];
}

interface AuthCtx {
  session: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  sair: () => Promise<void>;
  /** ADMIN/DONO têm acesso total; funcionário (FISCAL) precisa da permissão específica. */
  pode: (permissao: string) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  // só sabemos se há sessão DEPOIS que getSession()/onAuthStateChange resolve —
  // sem isso, o app redireciona p/ /login antes da sessão do localStorage carregar
  // (dava "logout" no hard refresh). Guardamos os guards até resolver.
  const [sessaoResolvida, setSessaoResolvida] = useState(false);

  // acompanha a sessão do Supabase Auth (restaura do localStorage no load)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessaoResolvida(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setSessaoResolvida(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // resolve o perfil do domínio (papel + secretaria) a partir do vínculo authUserId.
  // A RLS da tabela Usuario permite ler apenas a própria linha.
  useEffect(() => {
    if (!sessaoResolvida) return; // espera saber se há sessão antes de decidir
    let ativo = true;
    async function carregar() {
      if (!session?.user) {
        setPerfil(null);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      const { data } = await supabase
        .from("Usuario")
        .select("id,nome,email,papel,secretariaId,permissoes")
        .eq("authUserId", session.user.id)
        .maybeSingle();
      if (ativo) {
        const p = data as Perfil | null;
        if (p) p.permissoes = p.permissoes ?? [];
        setPerfil(p ?? null);
        setCarregando(false);
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [session, sessaoResolvida]);

  async function sair() {
    await supabase.auth.signOut();
  }

  // DONO = tudo. ADMIN SEM permissões definidas = admin pleno da secretaria (tudo).
  // ADMIN/FISCAL COM permissões = restrito ao que foi concedido (funcionário).
  function pode(permissao: string): boolean {
    if (!perfil) return false;
    if (perfil.papel === "DONO") return true;
    if (perfil.papel === "ADMIN" && perfil.permissoes.length === 0) return true;
    return perfil.permissoes.includes(permissao);
  }

  return (
    <Ctx.Provider value={{ session, perfil, carregando, sair, pode }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return c;
}
