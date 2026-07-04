// Validação segura de uploads (Edge Functions): tamanho + tipo por EXTENSÃO E CONTEÚDO.
// Checar só a extensão não basta — verificamos os "magic bytes" (assinatura) do arquivo,
// para impedir conteúdo malicioso renomeado (ex.: script salvo como .png/.pdf).

export const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf",
};

function assinaturaConfere(b: Uint8Array, ext: string): boolean {
  const em = (sig: number[], off = 0) => sig.every((x, i) => b[off + i] === x);
  switch (ext) {
    case "png": return em([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg": return em([0xff, 0xd8, 0xff]);
    case "webp": return em([0x52, 0x49, 0x46, 0x46]) && em([0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
    case "pdf": return em([0x25, 0x50, 0x44, 0x46]); // %PDF
    default: return false;
  }
}

export type ArquivoValido = { ok: true; ext: string; bytes: Uint8Array; contentType: string };
export type ArquivoErro = { ok: false; erro: string; status: number };

// Lê o File, valida tamanho, extensão permitida e assinatura de conteúdo. Devolve os bytes p/ upload.
export async function lerArquivoValidado(file: File, permitidas: Set<string>): Promise<ArquivoValido | ArquivoErro> {
  if (file.size === 0) return { ok: false, erro: "Anexe um arquivo.", status: 400 };
  if (file.size > MAX_BYTES) return { ok: false, erro: `Arquivo muito grande (máx. ${Math.round(MAX_BYTES / 1024 / 1024)} MB).`, status: 400 };
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  if (!permitidas.has(ext)) return { ok: false, erro: `Tipo não permitido: .${ext}`, status: 400 };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!assinaturaConfere(bytes, ext)) return { ok: false, erro: "O conteúdo do arquivo não corresponde à extensão informada.", status: 400 };
  return { ok: true, ext, bytes, contentType: MIME[ext] ?? "application/octet-stream" };
}
