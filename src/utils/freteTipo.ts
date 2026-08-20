/**
 * Tipo do frete — regra única de "isto saiu de uma pedreira?".
 *
 * Por que existe este módulo:
 *   O "Saldo na Pedreira" (Σ qtd dos pedidos − Σ qtd dos fretes) é derivado no
 *   front, e o mesmo cálculo aparece em três lugares independentes
 *   (FreteDashboard duas vezes, anomalias/detect.ts uma). Se a regra de excluir
 *   frete de transferência ficasse escrita em cada um deles, bastaria alguém
 *   mexer em um para o saldo passar a divergir do alerta de anomalia — em
 *   silêncio, porque nenhum dos dois estoura erro.
 *
 * A regra:
 *   - `material`      → a viagem TIROU material de uma pedreira. Desconta o
 *                       saldo daquela pedreira.
 *   - `transferencia` → a viagem MOVEU material que a EMT já tinha, de um ponto
 *                       a outro. Não desconta saldo de pedreira nenhuma, mas
 *                       gera crédito normal para a transportadora que a fez.
 *
 * Fretes gravados antes da migration `20260820163500` não têm o campo; o
 * default do banco é 'material' e aqui a leitura também assume 'material',
 * para que um registro legado nunca suma de um relatório por omissão.
 */

export type TipoFrete = 'material' | 'transferencia';

export const TIPOS_FRETE: TipoFrete[] = ['material', 'transferencia'];

export const TIPO_FRETE_LABEL: Record<TipoFrete, string> = {
  material: 'Material',
  transferencia: 'Transferência',
};

/** Forma mínima aceita: qualquer objeto que carregue (ou não) o campo tipo. */
export interface ComTipoFrete {
  tipo?: TipoFrete | string | null;
}

/** Lê o tipo de forma tolerante. Ausente, nulo ou desconhecido = 'material'. */
export function tipoDoFrete(f: ComTipoFrete | null | undefined): TipoFrete {
  return f?.tipo === 'transferencia' ? 'transferencia' : 'material';
}

export function ehTransferencia(f: ComTipoFrete | null | undefined): boolean {
  return tipoDoFrete(f) === 'transferencia';
}

/** True quando a viagem saiu de uma pedreira e deve descontar o saldo dela. */
export function ehFreteDePedreira(f: ComTipoFrete | null | undefined): boolean {
  return !ehTransferencia(f);
}

/**
 * Recorte a usar em TODO cálculo que envolva pedreira: saldo, custo por
 * pedreira, preço de material e os detectores de anomalia F1/F2/F3.
 */
export function apenasFretesDePedreira<T extends ComTipoFrete>(fretes: T[]): T[] {
  return fretes.filter(ehFreteDePedreira);
}
