import { describe, it, expect } from 'vitest';
import { montarLinhasSaldoCard, SALDO_ZERO } from './freteSaldoCard';

const fmt = (n: number) => n.toFixed(2);

describe('montarLinhasSaldoCard', () => {
  it('mostra Crédito Frete e Pago Frete sempre', () => {
    const linhas = montarLinhasSaldoCard(
      { saldo: 10, creditoFreteTotal: 30, pagoFreteTotal: 20, debitoCombustivelTotal: 0 },
      fmt,
    );
    expect(linhas).toEqual([
      { label: 'Crédito Frete', valor: '+30.00' },
      { label: 'Pago Frete', valor: '−20.00' },
    ]);
  });

  it('inclui Débito Combustível só quando > 0', () => {
    const linhas = montarLinhasSaldoCard(
      { saldo: -5, creditoFreteTotal: 30, pagoFreteTotal: 20, debitoCombustivelTotal: 15 },
      fmt,
    );
    expect(linhas).toHaveLength(3);
    expect(linhas[2]).toEqual({ label: 'Débito Combustível', valor: '−15.00' });
  });

  it('fornecedor sem movimento (SALDO_ZERO) gera só as duas linhas zeradas', () => {
    const linhas = montarLinhasSaldoCard(SALDO_ZERO, fmt);
    expect(linhas).toEqual([
      { label: 'Crédito Frete', valor: '+0.00' },
      { label: 'Pago Frete', valor: '−0.00' },
    ]);
  });
});
