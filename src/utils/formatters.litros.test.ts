import { describe, it, expect } from 'vitest';
import { formatLitros, formatLitrosNumero, formatCapacidadeLitros } from './formatters';

// Intl pt-BR usa espaço não separável em alguns formatos; aqui não tem unidade
// dentro do toLocaleString, então o separador é ponto/vírgula normal.
describe('formatLitrosNumero', () => {
  it('LINHA DE CONTROLE: o tanque real de 155,6 L não pode sair como 156', () => {
    // Tanque Canteiro 2 no banco = 155.600. Antes a tela mostrava "156 L".
    expect(formatLitrosNumero(155.6)).toBe('155,60');
    expect(formatLitrosNumero(155.6)).not.toBe('156');
  });

  it('força 2 casas mesmo em valor redondo', () => {
    expect(formatLitrosNumero(1880)).toBe('1.880,00');
    expect(formatLitrosNumero(0)).toBe('0,00');
  });

  it('agrupa milhar', () => {
    expect(formatLitrosNumero(10571)).toBe('10.571,00');
  });

  it('arredonda a 3ª casa do banco (numeric(x,3)) pra 2 na exibição', () => {
    expect(formatLitrosNumero(155.605)).toBe('155,61');
    expect(formatLitrosNumero(155.604)).toBe('155,60');
  });
});

describe('formatLitros', () => {
  it('anexa a unidade', () => {
    expect(formatLitros(155.6)).toBe('155,60 L');
  });
});

describe('formatCapacidadeLitros', () => {
  it('capacidade redonda fica sem casas (é cadastro, não medição)', () => {
    expect(formatCapacidadeLitros(15000)).toBe('15.000');
    expect(formatCapacidadeLitros(4000)).toBe('4.000');
  });

  it('mas não esconde decimal que exista no cadastro', () => {
    expect(formatCapacidadeLitros(4500.5)).toBe('4.500,5');
  });
});
