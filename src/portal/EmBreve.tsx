// Placeholder temporário das abas do portal ainda não migradas.
export default function EmBreve({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold text-slate-900">{titulo}</h1>
      <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
        Em construção — próxima etapa da migração.
      </p>
    </div>
  );
}
