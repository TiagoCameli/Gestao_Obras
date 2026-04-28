export interface CrossFilters {
  transportadora?: string;
  obraId?: string;
  insumoId?: string;
  origem?: string;
  destino?: string;
  mes?: string; // YYYY-MM
  metodo?: string;
  pagoPor?: string;
}

export type CrossDim = keyof CrossFilters;

export const CROSS_DIM_LABELS: Record<CrossDim, string> = {
  transportadora: 'Transportadora',
  obraId: 'Obra',
  insumoId: 'Material',
  origem: 'Pedreira',
  destino: 'Destino',
  mes: 'Mês',
  metodo: 'Método',
  pagoPor: 'Pago por',
};
