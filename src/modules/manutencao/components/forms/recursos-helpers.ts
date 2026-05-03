import type { PecaConsumo, FluidoConsumo } from '../../types';
import type {
  RecursoPecaUsada,
  RecursoFluidoUsado,
} from './RecursosConsumidos';

export function pecasIniciais(planejadas: PecaConsumo[]): RecursoPecaUsada[] {
  return planejadas.map((p) => ({
    partNumber: p.partNumber,
    quantity: p.quantity,
    notes: p.notes,
    usado: true,
    extra: false,
  }));
}

export function fluidosIniciais(planejados: FluidoConsumo[]): RecursoFluidoUsado[] {
  return planejados.map((f) => ({
    fluidoId: f.fluidoId,
    quantityLiters: f.quantityLiters,
    notes: f.notes,
    usado: true,
    extra: false,
  }));
}
