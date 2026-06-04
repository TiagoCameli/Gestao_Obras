// src/utils/fretePassivoEmt.test.ts
import { describe, it, expect } from 'vitest';
import { calcularPassivoEmt } from './fretePassivoEmt';

type Transp = { id: string; nome: string; ehTransportadora: boolean };

const TRANSP: Transp[] = [
  { id: 'areacre', nome: 'Areacre', ehTransportadora: true },
  { id: 'lmc', nome: 'LMC Transportadora', ehTransportadora: true },
  { id: 'andrade', nome: 'Andrade Transporte', ehTransportadora: true },
  { id: 'emt', nome: 'EMT TRANSPORTES', ehTransportadora: true },
  { id: 'etam', nome: 'ETAM Construtora', ehTransportadora: true },
  { id: 'pedreira', nome: 'Pedreira X', ehTransportadora: false },
];

const saldos = (m: Record<string, number>) =>
  new Map(Object.entries(m).map(([id, saldo]) => [id, { saldo }]));

describe('calcularPassivoEmt', () => {
  it('soma os saldos das transportadoras 3rd-party e exclui a empresa própria (ETAM)', () => {
    const r = calcularPassivoEmt(
      TRANSP,
      saldos({ areacre: 653, lmc: 30, andrade: 126, emt: 521, etam: 999 }),
      'ETAM Construtora',
    );
    expect(r.total).toBe(653 + 30 + 126 + 521); // ETAM fora, mesmo com saldo 999
    expect(r.linhas.some((l) => l.nome === 'ETAM Construtora')).toBe(false);
    expect(r.linhas.some((l) => l.nome === 'Pedreira X')).toBe(false); // não é transportadora
  });

  it('inclui LMC (ex-Triunfo) sem depender de nome chumbado', () => {
    const r = calcularPassivoEmt(TRANSP, saldos({ lmc: 30 }), 'ETAM Construtora');
    expect(r.linhas.find((l) => l.nome === 'LMC Transportadora')?.saldo).toBe(30);
  });

  it('transportadora sem movimento entra com saldo 0', () => {
    const r = calcularPassivoEmt(TRANSP, saldos({ areacre: 100 }), 'ETAM Construtora');
    expect(r.linhas.find((l) => l.nome === 'Andrade Transporte')?.saldo).toBe(0);
  });

  it('exclui a empresa própria sem diferenciar maiúsculas/minúsculas', () => {
    const r = calcularPassivoEmt(TRANSP, saldos({ etam: 50 }), 'etam construtora');
    expect(r.linhas.some((l) => l.nome === 'ETAM Construtora')).toBe(false);
  });

  it('ordena as linhas por saldo decrescente', () => {
    const r = calcularPassivoEmt(
      TRANSP,
      saldos({ areacre: 653, lmc: 30, andrade: 126, emt: 521, etam: 0 }),
      'ETAM Construtora',
    );
    expect(r.linhas.map((l) => l.nome)).toEqual([
      'Areacre',
      'EMT TRANSPORTES',
      'Andrade Transporte',
      'LMC Transportadora',
    ]);
  });
});
