/** Agregado de movimentos de uma transportadora dentro do recorte filtrado. */
export interface SaldoAgregado {
  saldo: number;
  creditoFreteTotal: number;
  pagoFreteTotal: number;
  debitoCombustivelTotal: number;
}

/** Agregado vazio pra fornecedor sem nenhum movimento de frete. */
export const SALDO_ZERO: SaldoAgregado = {
  saldo: 0,
  creditoFreteTotal: 0,
  pagoFreteTotal: 0,
  debitoCombustivelTotal: 0,
};

/**
 * Monta as linhas de detalhe de um SaldoCard. O sinal de menos usado é o
 * caractere "−" (U+2212), igual ao resto do dashboard. Débito Combustível só
 * aparece quando há débito (cobre donas de tanque sem hardcode).
 */
export function montarLinhasSaldoCard(
  agg: SaldoAgregado,
  formatCurrency: (n: number) => string,
): { label: string; valor: string }[] {
  const linhas = [
    { label: 'Crédito Frete', valor: `+${formatCurrency(agg.creditoFreteTotal)}` },
    { label: 'Pago Frete', valor: `−${formatCurrency(agg.pagoFreteTotal)}` },
  ];
  if (agg.debitoCombustivelTotal > 0) {
    linhas.push({ label: 'Débito Combustível', valor: `−${formatCurrency(agg.debitoCombustivelTotal)}` });
  }
  return linhas;
}
