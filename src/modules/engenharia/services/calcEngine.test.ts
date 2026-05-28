import { describe, it, expect } from 'vitest';
import { evalSafe, parseLinha } from './calcEngine';

describe('calcEngine.evalSafe sandbox', () => {
  it('avalia aritmética simples', () => {
    expect(evalSafe('1+1')).toBe(2);
    expect(evalSafe('2*5')).toBe(10);
    expect(evalSafe('sqrt(16)')).toBe(4);
  });

  it('throws em import("foo") — sandbox', () => {
    expect(() => evalSafe('import("foo")')).toThrow();
  });

  it('throws em createUnit', () => {
    expect(() => evalSafe('createUnit("xyz")')).toThrow();
  });

  it('respeita scope passado', () => {
    expect(evalSafe('x * 2', { x: 21 })).toBe(42);
  });
});

describe('parseLinha — cenários 5.5 do prompt original', () => {
  it('linha vazia → alerta=vazio', () => {
    const r = parseLinha('');
    expect(r.alerta).toBe('vazio');
    expect(r.resultado).toBeNull();
  });

  it('sem `=` → alerta=vazio (mostra só texto)', () => {
    const r = parseLinha('memória de cálculo');
    expect(r.alerta).toBe('vazio');
  });

  it('`1+1=` → preenche 2, alerta=ok', () => {
    const r = parseLinha('1+1=');
    expect(r.resultado).toBe('2');
    expect(r.alerta).toBe('ok');
    expect(r.rhsUsuario).toBeNull();
  });

  it('`2*5=20` → alerta=erro (RHS nao bate com 10)', () => {
    // NOTA: prompt original listava `2*5=20 -> ok` o que e matematicamente
    // errado. Aqui seguimos a regra real: RHS deve bater com o calculado.
    const r = parseLinha('2*5=20');
    expect(r.resultado).toBe('10');
    expect(r.alerta).toBe('erro');
  });

  it('`2*10=20` → ok (numericamente bate)', () => {
    const r = parseLinha('2*10=20');
    expect(r.alerta).toBe('ok');
    expect(r.resultado).toBe('20');
  });

  it('`2*5=11` → alerta=erro', () => {
    const r = parseLinha('2*5=11');
    expect(r.resultado).toBe('10');
    expect(r.alerta).toBe('erro');
    expect(r.rhsUsuario).toBe('11');
  });

  it('expressão inválida → alerta=erro + erroEngine', () => {
    const r = parseLinha('1+=2');
    expect(r.alerta).toBe('erro');
    expect(r.erroEngine).toBeTruthy();
  });

  it('tolera epsilon: 0.1+0.2=0.3', () => {
    const r = parseLinha('0.1+0.2=0.3');
    expect(r.alerta).toBe('ok');
  });

  it('LHS vazio (`=10`) → alerta=vazio (UX neutra)', () => {
    const r = parseLinha('=10');
    expect(r.alerta).toBe('vazio');
  });
});
