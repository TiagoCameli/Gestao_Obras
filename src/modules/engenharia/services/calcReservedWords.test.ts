import { describe, it, expect } from 'vitest';
import { ehReservada, normalizarNome, PALAVRAS_RESERVADAS } from './calcReservedWords';

describe('calcReservedWords', () => {
  it('reconhece funções math.js como reservadas', () => {
    expect(ehReservada('sin')).toBe(true);
    expect(ehReservada('log10')).toBe(true);
    expect(ehReservada('sqrt')).toBe(true);
    expect(ehReservada('pi')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(ehReservada('SIN')).toBe(true);
    expect(ehReservada('Log10')).toBe(true);
  });

  it('nomes de usuário comuns NÃO são reservados', () => {
    expect(ehReservada('x')).toBe(false);
    expect(ehReservada('viga_principal')).toBe(false);
    expect(ehReservada('brita4')).toBe(false);
    expect(ehReservada('Brita 4')).toBe(false);
  });

  it('normalizarNome colapsa espaços e baixa caixa', () => {
    expect(normalizarNome('  Brita   4 ')).toBe('brita 4');
    expect(normalizarNome('VIGA')).toBe('viga');
  });

  it('lista tem ao menos 30 entradas', () => {
    expect(PALAVRAS_RESERVADAS.size).toBeGreaterThanOrEqual(30);
  });
});
