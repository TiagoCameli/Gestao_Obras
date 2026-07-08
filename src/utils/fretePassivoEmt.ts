// src/utils/fretePassivoEmt.ts

export interface PassivoLinha {
  nome: string;
  saldo: number;
}

export interface PassivoEmt {
  total: number;
  linhas: PassivoLinha[];
}

/**
 * "A Pagar EMT" = soma dos saldos de todas as transportadoras terceiras
 * e donas de tanque externo (crédito de abastecimento é dívida da EMT
 * com a dona, ex.: Posto Progresso).
 *
 * Inclui pelos flags `ehTransportadora`/`ehDonaDeTanque`, NÃO por nome
 * chumbado — resiliente a renome (ex.: "Transportadora Triunfo" virou "LMC
 * Transportadora" e o card antigo, que buscava por nome, ficava zerado).
 * Exclui apenas a própria empresa (`nomeEmpresaPropria`, ex.: ETAM
 * Construtora — não é terceira). Linhas ordenadas por saldo decrescente
 * (maior passivo primeiro).
 */
export function calcularPassivoEmt(
  transportadoras: { id: string; nome: string; ehTransportadora: boolean; ehDonaDeTanque?: boolean }[],
  saldoPorId: Map<string, { saldo: number }>,
  nomeEmpresaPropria: string,
): PassivoEmt {
  const proprio = nomeEmpresaPropria.trim().toLowerCase();
  const linhas = transportadoras
    .filter((f) => (f.ehTransportadora || f.ehDonaDeTanque) && f.nome.trim().toLowerCase() !== proprio)
    .map((f) => ({ nome: f.nome, saldo: saldoPorId.get(f.id)?.saldo ?? 0 }))
    .sort((a, b) => b.saldo - a.saldo);
  const total = linhas.reduce((s, l) => s + l.saldo, 0);
  return { total, linhas };
}
