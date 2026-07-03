// Helpers puros do fluxo "lançar peça/óleo no serviço com baixa de estoque".
// Usados pelos modais de peça e óleo. Testáveis isoladamente.

import type { SaldoEstoquePorDeposito } from '../types';

/** Só os depósitos com saldo positivo (os que podem fornecer o item). */
export function depositosComSaldo(saldos: SaldoEstoquePorDeposito[]): SaldoEstoquePorDeposito[] {
  return saldos.filter((s) => s.saldo > 0);
}

/** Acha a linha de saldo de um depósito específico (ou null). */
export function acharSaldoDeposito(
  saldos: SaldoEstoquePorDeposito[],
  depositoId: string,
): SaldoEstoquePorDeposito | null {
  return saldos.find((s) => s.depositoId === depositoId) ?? null;
}

/** Valida a quantidade contra o saldo do depósito. Retorna mensagem de erro ou null se ok. */
export function validarQtdContraSaldo(qtd: number, saldo: number): string | null {
  if (!(qtd > 0)) return 'Quantidade deve ser maior que zero';
  if (qtd > saldo) {
    return `Acima do saldo disponível (${saldo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })})`;
  }
  return null;
}
