// Tipos da fila (espelham o payload da Edge Function `enquete`).
export interface ItemFila {
  reservaId: string;
  nome: string;
  fotoUrl: string | null;
  localidadeId: string | null;
  localidade: string | null;
  hora: string;
  status: "CONFIRMADA" | "ESPERA";
  onibusNome: string | null;
  posicao: number | null;
  transbordo: boolean;
}

export interface DadosFila {
  confirmados: number;
  emEspera: number;
  naFila: number;
  voltam: number;
  itens: ItemFila[];
}

export interface EstadoEnquete {
  viagem: { id: string; status: string; horario: string; abreEm: string | null; fechaEm: string | null } | null;
  fila: DadosFila | null;
  minhaReserva: { status: string; vaiIda: boolean; vaiVolta: boolean } | null;
  autorizado: boolean;
  aberta: boolean;
  localidades: { id: string; nome: string }[];
  localidadeId: string | null;
}
