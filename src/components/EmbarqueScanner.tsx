import { useEffect, useRef, useState } from "react";
import { Camera, Nfc, X, CameraOff, Check, AlertTriangle } from "lucide-react";

export type ResultadoScan = { resultado: string; nome?: string; fotoUrl?: string | null; mensagem: string };

function iniciais(n?: string) { return (n ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }

// Leitor de embarque: QR pela câmera (BarcodeDetector) + NFC por aproximação (Web NFC / NDEFReader).
// Emite o TEXTO lido (URL .../v/<token> ou token puro) — quem consome resolve no backend.
// Alvo: Chrome no Android (câmera + NFC). Em navegadores sem suporte, mostra aviso claro.

// tipos mínimos das APIs experimentais (não estão no lib.dom padrão)
type Detected = { rawValue: string };
interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<Detected[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
interface NDEFRecordLike { recordType: string; data?: BufferSource; encoding?: string }
interface NDEFMessageLike { records: NDEFRecordLike[] }
interface NDEFReaderLike { scan(opts?: { signal?: AbortSignal }): Promise<void>; onreading: ((e: { message: NDEFMessageLike }) => void) | null; onreadingerror: (() => void) | null }
type NDEFReaderCtor = new () => NDEFReaderLike;

function lerRegistroNfc(msg: NDEFMessageLike): string {
  for (const r of msg.records) {
    if (!r.data) continue;
    try {
      const dec = new TextDecoder(r.encoding || "utf-8");
      const txt = dec.decode(r.data);
      if (r.recordType === "url" || r.recordType === "text" || r.recordType === "absolute-url") return txt;
      if (txt) return txt;
    } catch { /* ignora registro ilegível */ }
  }
  return "";
}

export default function EmbarqueScanner({
  aberto, nfcAtivo, feedback, onTexto, onFechar,
}: {
  aberto: boolean;
  nfcAtivo: boolean;
  feedback: ResultadoScan | null;
  onTexto: (texto: string) => void;
  onFechar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erroCam, setErroCam] = useState<string | null>(null);
  const [nfcEstado, setNfcEstado] = useState<"ocioso" | "lendo" | "erro" | "indisponivel">("ocioso");
  const ultimo = useRef<{ texto: string; t: number }>({ texto: "", t: 0 });

  const emitir = (texto: string) => {
    const t = Date.now();
    if (texto === ultimo.current.texto && t - ultimo.current.t < 2500) return; // ignora releitura imediata
    
    // Verificação de segurança (padronização do QRCode)
    // O QRCode/NFC válido deve conter /v/<jwt> ou ser o próprio JWT (eyJ...)
    const padrao = texto.match(/\/v\/([^/?#\s]+)/) || texto.match(/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    if (!padrao && !texto.includes('eyJ')) {
      return; // Ignora localmente se não tiver o padrão, evitando alertas falsos (ex: scanner PIX)
    }

    ultimo.current = { texto, t };
    onTexto(texto);
    if ("vibrate" in navigator) navigator.vibrate?.(60);
  };

  // câmera + BarcodeDetector
  useEffect(() => {
    if (!aberto) return;
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) { setErroCam("Este navegador não lê QR pela câmera. Use o Chrome no Android."); return; }

    let stream: MediaStream | null = null;
    let raf = 0;
    let ativo = true;
    const detector = new Ctor({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!ativo) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play(); }
      } catch {
        setErroCam("Não foi possível acessar a câmera. Verifique a permissão.");
        return;
      }
      const tick = async () => {
        const v = videoRef.current;
        if (ativo && v && v.readyState >= 2) {
          try {
            const marcas = await detector.detect(v);
            if (marcas[0]?.rawValue) emitir(marcas[0].rawValue);
          } catch { /* frame sem leitura */ }
        }
        if (ativo) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      ativo = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // NFC (aproximação) — só quando o DONO ativou e o navegador suporta
  useEffect(() => {
    if (!aberto || !nfcAtivo) return;
    const Ctor = (window as unknown as { NDEFReader?: NDEFReaderCtor }).NDEFReader;
    if (!Ctor) { setNfcEstado("indisponivel"); return; }
    const ctrl = new AbortController();
    const reader = new Ctor();
    setNfcEstado("lendo");
    reader.onreading = (e) => { const txt = lerRegistroNfc(e.message); if (txt) emitir(txt); };
    reader.onreadingerror = () => setNfcEstado("erro");
    reader.scan({ signal: ctrl.signal }).catch(() => setNfcEstado("erro"));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, nfcAtivo]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold"><Camera className="h-5 w-5" /> Escanear carteirinha</p>
        <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {erroCam ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-300">
            <CameraOff className="h-10 w-10 text-slate-500" />
            <p className="text-sm">{erroCam}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {/* mira */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-56 w-56 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
          </>
        )}
      </div>

      {feedback && (() => {
        const ok = feedback.resultado === "OK";
        const aviso = feedback.resultado === "JA_EMBARCADO";
        const tom = ok ? "bg-emerald-600" : aviso ? "bg-amber-500" : "bg-red-600";
        return (
          <div className={`flex items-center gap-3 px-4 py-3 text-white ${tom}`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/25 text-sm font-semibold">
              {feedback.fotoUrl ? <img src={feedback.fotoUrl} alt="" className="h-full w-full object-cover" /> : iniciais(feedback.nome)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{feedback.nome ?? "—"}</p>
              <p className="truncate text-xs text-white/90">{feedback.mensagem}</p>
            </div>
            {ok ? <Check className="h-6 w-6 shrink-0" /> : <AlertTriangle className="h-6 w-6 shrink-0" />}
          </div>
        );
      })()}

      <div className="space-y-2 px-4 py-3 text-center text-slate-300">
        <p className="text-xs">Aponte para o QR da carteirinha do aluno.</p>
        {nfcAtivo && (
          <p className="flex items-center justify-center gap-1.5 text-xs">
            <Nfc className={`h-4 w-4 ${nfcEstado === "lendo" ? "text-emerald-400" : "text-slate-500"}`} />
            {nfcEstado === "lendo" && "Aproximação ativa — encoste a tag/carteirinha NFC."}
            {nfcEstado === "indisponivel" && "NFC não suportado neste navegador (use Chrome no Android)."}
            {nfcEstado === "erro" && "Falha ao ler NFC. Tente novamente."}
            {nfcEstado === "ocioso" && "Iniciando NFC…"}
          </p>
        )}
      </div>
    </div>
  );
}
