import { describe, it, expect } from 'vitest';
import { recalcularPrancha, type CaixaCalc } from './calcDocumento';
import type { LinhaCalculo } from '../types/calculo';

function linha(id: string, expressao: string): LinhaCalculo {
  return { id, expressao, resultado: null, alerta: 'vazio', ordem: 0 };
}

describe('recalcularPrancha — escopo compartilhado entre caixas', () => {
  it('variável definida numa caixa é usada em outra (independe da posição)', () => {
    // caixa A (em baixo) USA brita4; caixa B (em cima) DEFINE brita4
    const caixaA: CaixaCalc = { id: 'A', x: 0, y: 200, linhas: [linha('a1', 'brita4 + 2 =')] };
    const caixaB: CaixaCalc = { id: 'B', x: 0, y: 0, linhas: [linha('b1', '"Brita4" = 121.98')] };
    const r = recalcularPrancha([caixaA, caixaB]);
    const a1 = r.get('A')![0];
    expect(a1.alerta).toBe('ok');
    expect(Number(a1.resultado)).toBeCloseTo(123.98, 2);
    const b1 = r.get('B')![0];
    expect(b1.alerta).toBe('ok');
    expect(b1.varDefinida).toBe('brita4');
  });

  it('variável numérica cruza caixas e faz cascade', () => {
    const a: CaixaCalc = { id: 'A', x: 0, y: 0, linhas: [linha('a1', 'x = 4')] };
    const b: CaixaCalc = { id: 'B', x: 0, y: 100, linhas: [linha('b1', 'x * 2 =')] };
    const r = recalcularPrancha([a, b]);
    expect(Number(r.get('B')![0].resultado)).toBe(8);
  });

  it('conflito: primeira definição na ordem de leitura (topo) vence', () => {
    const topo: CaixaCalc = { id: 'topo', x: 0, y: 0, linhas: [linha('t1', 'x = 10')] };
    const baixo: CaixaCalc = { id: 'baixo', x: 0, y: 300, linhas: [linha('b1', 'x = 99'), linha('b2', 'x =')] };
    const r = recalcularPrancha([baixo, topo]); // ordem de entrada embaralhada de proposito
    // x usado em b2 deve refletir a definição do topo (10), não 99
    expect(Number(r.get('baixo')![1].resultado)).toBe(10);
  });

  it('referência a variável inexistente continua dando erro', () => {
    const a: CaixaCalc = { id: 'A', x: 0, y: 0, linhas: [linha('a1', 'naoexiste + 1 =')] };
    const r = recalcularPrancha([a]);
    expect(r.get('A')![0].alerta).toBe('erro');
  });

  it('preserva a ordem das linhas dentro de cada caixa e mapeia por id de caixa', () => {
    const a: CaixaCalc = { id: 'A', x: 0, y: 0, linhas: [linha('a1', 'y = 3'), linha('a2', 'y + 1 =')] };
    const r = recalcularPrancha([a]);
    expect(r.get('A')!.map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(Number(r.get('A')![1].resultado)).toBe(4);
  });
});
