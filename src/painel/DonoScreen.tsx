import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, LogOut, UserCog, Nfc, MapPin } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

interface Secretaria { id: string; nome: string; municipio: string; uf: string; status: string }

export default function DonoScreen() {
  const { perfil, sair } = useAuth();
  const qc = useQueryClient();
  const [novo, setNovo] = useState(false);

  const { data: secretarias, isLoading } = useQuery({
    queryKey: ["dono-secretarias"],
    queryFn: async () => {
      const { data } = await supabase.from("Secretaria").select("id,nome,municipio,uf,status").order("nome");
      return (data as Secretaria[]) ?? [];
    },
  });

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-slate-50">
      <header className="flex items-center justify-between bg-brand-900 px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/sysbus-logo.png" alt="SYSBUS" className="h-8 w-auto object-contain rounded-lg" />
          <span className="text-xs font-medium text-slate-300">· Plataforma ({perfil?.nome})</span>
        </div>
        <button onClick={() => sair()} className="inline-flex items-center gap-1 text-sm text-slate-300"><LogOut className="h-4 w-4" /> Sair</button>
      </header>

      <main className="space-y-4 p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Secretarias</h1>
          <button onClick={() => setNovo((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900">
            <Plus className="h-4 w-4" /> Nova secretaria
          </button>
        </div>

        {novo && <NovaSecretaria aoConcluir={() => { setNovo(false); qc.invalidateQueries({ queryKey: ["dono-secretarias"] }); }} />}

        <FlagsPlataforma />
        <MigracaoLegados />

        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
        ) : (secretarias ?? []).length === 0 ? (
          <p className="rounded-lg bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200">Nenhuma secretaria ainda.</p>
        ) : (
          <div className="space-y-2">
            {(secretarias ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl bg-white p-4 ring-1 ring-slate-200">
                <div>
                  <p className="font-medium text-slate-800">{s.nome}</p>
                  <p className="text-xs text-slate-400">{s.municipio}/{s.uf}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.status === "ATIVA" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FlagsPlataforma() {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const { data: cfg } = useQuery({
    queryKey: ["config-plataforma"],
    queryFn: async () => {
      const { data } = await supabase.from("ConfiguracaoPlataforma").select("nfcAtivo, itinerarioAtivo").eq("id", "GLOBAL").maybeSingle();
      return (data as { nfcAtivo: boolean; itinerarioAtivo: boolean } | null) ?? { nfcAtivo: false, itinerarioAtivo: false };
    },
  });
  const nfcAtivo = Boolean(cfg?.nfcAtivo);
  const itinerarioAtivo = Boolean(cfg?.itinerarioAtivo);

  async function alternar(campo: "nfcAtivo" | "itinerarioAtivo", valor: boolean) {
    setSalvando(true);
    await supabase.from("ConfiguracaoPlataforma").update({ [campo]: valor, atualizadoEm: new Date().toISOString() }).eq("id", "GLOBAL");
    await qc.invalidateQueries({ queryKey: ["config-plataforma"] });
    setSalvando(false);
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <Nfc className="h-4 w-4 text-slate-600" />
        <p className="text-sm font-semibold text-slate-800">Recursos da plataforma</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">Embarque por aproximação (NFC)</p>
          <p className="text-xs text-slate-500">Quando ligado, o monitor pode registrar o embarque encostando a carteirinha/tag NFC (Chrome no Android). O leitor de QR continua sempre disponível.</p>
        </div>
        <Switch on={nfcAtivo} disabled={salvando} onToggle={() => alternar("nfcAtivo", !nfcAtivo)} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700"><MapPin className="h-3.5 w-3.5 text-slate-400" /> Itinerário e pontos (operação da viagem)</p>
          <p className="text-xs text-slate-500">Configuração de pontos de embarque/retorno, ponto atual do ônibus e "quem falta". Em revisão — mantenha desligado por enquanto.</p>
        </div>
        <Switch on={itinerarioAtivo} disabled={salvando} onToggle={() => alternar("itinerarioAtivo", !itinerarioAtivo)} />
      </div>
    </div>
  );
}

function Switch({ on, disabled, onToggle }: { on: boolean; disabled?: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand-700" : "bg-slate-300"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

interface Legado { nome: string; email: string; papel: string }

function MigracaoLegados() {
  const [preview, setPreview] = useState<Legado[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function previsualizar() {
    setCarregando(true);
    setMsg(null);
    const { data } = await supabase.functions.invoke("migrar-legados", { body: { dryRun: true } });
    setPreview((data?.usuarios as Legado[]) ?? []);
    setCarregando(false);
  }

  async function migrar() {
    if (!window.confirm("Isso vai criar o acesso e ENVIAR um e-mail de convite para cada perfil legado. Continuar?")) return;
    setCarregando(true);
    const { data } = await supabase.functions.invoke("migrar-legados", { body: { dryRun: false, enviarEmail: true } });
    setCarregando(false);
    setPreview(null);
    setMsg(`Migrados ${data?.migrados ?? 0}/${data?.total ?? 0} perfis (convites enviados).`);
  }

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <UserCog className="h-4 w-4 text-slate-600" />
        <p className="text-sm font-semibold text-slate-800">Perfis legados (sem login)</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">Contas do sistema antigo que ainda não têm acesso ao novo. Migre para enviar o convite de definição de senha.</p>
      {msg && <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {preview === null ? (
        <button onClick={previsualizar} disabled={carregando} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {carregando ? "…" : "Pré-visualizar legados"}
        </button>
      ) : preview.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nenhum perfil legado pendente.</p>
      ) : (
        <div className="mt-3 space-y-2">
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-100">
            {preview.map((u) => (
              <li key={u.email} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-700">{u.nome} <span className="text-xs text-slate-400">· {u.email}</span></span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{u.papel}</span>
              </li>
            ))}
          </ul>
          <button onClick={migrar} disabled={carregando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
            {carregando ? "Migrando…" : `Migrar e convidar (${preview.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

function NovaSecretaria({ aoConcluir }: { aoConcluir: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tom: "ok" | "erro"; texto: string; link?: string } | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const f = new FormData(e.currentTarget);
    const body = {
      nome: f.get("nome"), municipio: f.get("municipio"), uf: f.get("uf"), cnpj: f.get("cnpj"),
      adminNome: f.get("adminNome"), adminEmail: f.get("adminEmail"),
    };
    const { data, error } = await supabase.functions.invoke("provisionar-secretaria", { body });
    setEnviando(false);
    if (error || !data?.ok) {
      let texto = "Não foi possível provisionar.";
      const ctx = (error as { context?: Response })?.context;
      try { if (ctx) texto = (await ctx.json()).error ?? texto; } catch { /* */ }
      setMsg({ tom: "erro", texto });
      return;
    }
    if (data.emailEnviado) setMsg({ tom: "ok", texto: "Secretaria criada e convite enviado ao responsável." });
    else setMsg({ tom: "ok", texto: "Secretaria criada. Envie este link ao responsável:", link: data.actionLink });
    (e.target as HTMLFormElement).reset();
    setTimeout(aoConcluir, data.emailEnviado ? 1200 : 8000);
  }

  const cls = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={enviar} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-800">Nova secretaria + responsável (ADMIN)</p>
      {msg && (
        <div className={`rounded-md px-3 py-2 text-sm ${msg.tom === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <p className="flex items-center gap-1">{msg.tom === "ok" && <Check className="h-4 w-4" />}{msg.texto}</p>
          {msg.link && <p className="mt-1 break-all text-xs text-slate-600">{msg.link}</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2"><span className="font-medium text-slate-700">Nome da secretaria *</span><input name="nome" required className={cls + " w-full"} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">Município *</span><input name="municipio" required className={cls + " w-full"} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">UF *</span><input name="uf" required maxLength={2} placeholder="PE" className={cls + " w-full"} /></label>
        <label className="block text-sm sm:col-span-2"><span className="font-medium text-slate-700">CNPJ</span><input name="cnpj" className={cls + " w-full"} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">Responsável *</span><input name="adminNome" required className={cls + " w-full"} /></label>
        <label className="block text-sm"><span className="font-medium text-slate-700">E-mail do responsável *</span><input name="adminEmail" type="email" required className={cls + " w-full"} /></label>
      </div>
      <button type="submit" disabled={enviando} className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60">
        {enviando ? "Criando…" : "Criar e convidar"}
      </button>
    </form>
  );
}
