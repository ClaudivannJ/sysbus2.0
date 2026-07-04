import { useEffect, useState } from "react";

// Camada offline do portal (PWA). Estratégia (decisão do produto: SERVIDOR AUTORITATIVO):
//  - LEITURA: guardamos a última resposta boa no localStorage; sem internet, mostramos ela.
//  - ESCRITA (voto): guardamos a ÚLTIMA ação pretendida (voto/desistência) e enviamos ao
//    reconectar. A POSIÇÃO na fila é definida quando o voto CHEGA ao servidor (à prova de
//    manipulação de relógio) — por isso o voto offline fica "pendente de envio".

// ---- conectividade ----
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

// ---- cache de leitura (última resposta boa) ----
const PREFIXO = "sysbus.cache.";
export function cacheSalvar(chave: string, dados: unknown) {
  try { localStorage.setItem(PREFIXO + chave, JSON.stringify({ em: Date.now(), dados })); } catch { /* cota cheia */ }
}
export function cacheLer<T>(chave: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIXO + chave);
    if (!raw) return null;
    return (JSON.parse(raw).dados as T) ?? null;
  } catch { return null; }
}

// ---- voto pendente (offline) — última ação vence ----
export type AcaoEnquete = {
  action: "confirmar" | "cancelar";
  intencao?: string;
  localidadeId?: string;
  em: number; // quando o aluno registrou no aparelho (só p/ exibir "salvo às …")
};
const CHAVE_PENDENTE = "sysbus.pendente.enquete";

export function salvarPendente(acao: AcaoEnquete) {
  try { localStorage.setItem(CHAVE_PENDENTE, JSON.stringify(acao)); } catch { /* */ }
}
export function lerPendente(): AcaoEnquete | null {
  try { const raw = localStorage.getItem(CHAVE_PENDENTE); return raw ? (JSON.parse(raw) as AcaoEnquete) : null; } catch { return null; }
}
export function limparPendente() {
  try { localStorage.removeItem(CHAVE_PENDENTE); } catch { /* */ }
}
