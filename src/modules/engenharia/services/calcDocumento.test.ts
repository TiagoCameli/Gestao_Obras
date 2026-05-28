import { describe, it, expect } from 'vitest';
import { recalcularDocumento, substituirAliases } from './calcDocumento';
import type { LinhaCalculo } from '../types/calculo';

let _id = 0;
function L(expressao: string): LinhaCalculo {
  return { id: `l${_id++}`, expressao, resultado: null, alerta: 'vazio', ordem: 0 };
}
function docFrom(...exprs: string[]) {
  return recalcularDocumento(exprs.map(L));
}

describe('recalcularDocumento — variáveis numéricas', () => {
  it('x=4 define x (atribuicao_num)', () => {
    const [a] = docFrom('x=4');
    expect(a.tipo).toBe('atribuicao_num');
    expect(a.varDefinida).toBe('x');
    expect(a.resultado).toBe('4');
    expect(a.alerta).toBe('ok');
  });

  it('x=2*2 depois x*2= → 8 (cascade)', () => {
    const r = docFrom('x=2*2', 'x*2=');
    expect(r[0].resultado).toBe('4');
    expect(r[1].tipo).toBe('avaliacao');
    expect(r[1].resultado).toBe('8');
    expect(r[1].alerta).toBe('ok');
  });

  it('variável usada antes de definida → erro', () => {
    const r = docFrom('y*2=');
    expect(r[0].alerta).toBe('erro');
    expect(r[0].erroEngine).toBeTruthy();
  });

  it('redefinição sobrescreve pra frente', () => {
    const r = docFrom('x=2', 'x*10=', 'x=5', 'x*10=');
    expect(r[1].resultado).toBe('20');
    expect(r[3].resultado).toBe('50');
  });
});

describe('recalcularDocumento — variáveis string + aliases', () => {
  it('"Brita 4" = 110 define string var (atribuicao_str)', () => {
    const [a] = docFrom('"Brita 4" = 110');
    expect(a.tipo).toBe('atribuicao_str');
    expect(a.varDefinida).toBe('brita 4');
    expect(a.resultado).toBe('110');
    expect(a.alerta).toBe('ok');
  });

  it('"Brita 4"=110 depois brita4 + 5 = → 115', () => {
    const r = docFrom('"Brita 4" = 110', 'brita4 + 5 =');
    expect(r[1].resultado).toBe('115');
    expect(r[1].alerta).toBe('ok');
  });

  it('alias tolera variações de caixa e espaço', () => {
    const r = docFrom('"Brita 4" = 110', 'Brita 4 =', 'BRITA 4 =', 'brita4 =');
    expect(r[1].resultado).toBe('110');
    expect(r[2].resultado).toBe('110');
    expect(r[3].resultado).toBe('110');
  });

  it('⭐ cenário canônico: x=4, y=3, "Brita 4"=110, x+y+brita4= → 117', () => {
    const r = docFrom('x=4', 'y=3', '"Brita 4" = 110', 'x+y+brita4=');
    expect(r[3].resultado).toBe('117');
    expect(r[3].alerta).toBe('ok');
  });

  it('greedy longest-match: "brita" e "brita 4" coexistem', () => {
    const r = docFrom('"brita" = 1', '"brita 4" = 110', 'brita 4 =', 'brita =');
    expect(r[2].resultado).toBe('110');
    expect(r[3].resultado).toBe('1');
  });
});

describe('recalcularDocumento — palavras reservadas', () => {
  it('"sin" = 5 rejeitado com erro inline', () => {
    const [a] = docFrom('"sin" = 5');
    expect(a.alerta).toBe('erro');
    expect(a.erroEngine).toMatch(/reservada/i);
  });

  it('sin = 5 (sem aspas, identificador) também rejeitado', () => {
    const [a] = docFrom('sin = 5');
    expect(a.alerta).toBe('erro');
    expect(a.erroEngine).toMatch(/reservada/i);
  });

  it('"log10" = 100 rejeitado', () => {
    const [a] = docFrom('"log10" = 100');
    expect(a.alerta).toBe('erro');
  });

  it('"viga_principal" = 5 aceito (não reservada)', () => {
    const [a] = docFrom('"viga_principal" = 5');
    expect(a.alerta).toBe('ok');
    expect(a.varDefinida).toBe('viga_principal');
  });

  it('função reservada ainda USÁVEL em expressão (só DEFINIR é bloqueado)', () => {
    const r = docFrom('sqrt(16)=');
    expect(r[0].resultado).toBe('4');
    expect(r[0].alerta).toBe('ok');
  });
});

describe('recalcularDocumento — compatibilidade Onda 5', () => {
  it('linha vazia → vazio', () => {
    expect(docFrom('')[0].alerta).toBe('vazio');
  });
  it('texto livre sem `=` → vazio', () => {
    expect(docFrom('memória de cálculo')[0].alerta).toBe('vazio');
  });
  it('1+1= → 2', () => {
    expect(docFrom('1+1=')[0].resultado).toBe('2');
  });
  it('2*5=11 → erro (RHS não bate)', () => {
    const [a] = docFrom('2*5=11');
    expect(a.resultado).toBe('10');
    expect(a.alerta).toBe('erro');
  });
});

describe('substituirAliases', () => {
  it('substitui forma com e sem espaço', () => {
    const aliases = [{ canonico: 'brita 4', chaveScope: '__sv_brita_4' }];
    expect(substituirAliases('brita4 + 5', aliases)).toBe('__sv_brita_4 + 5');
    expect(substituirAliases('BRITA 4 + 5', aliases)).toBe('__sv_brita_4 + 5');
  });
  it('sem aliases retorna expr intacta', () => {
    expect(substituirAliases('x + 1', [])).toBe('x + 1');
  });
});
