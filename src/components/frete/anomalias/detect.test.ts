import { describe, it, expect } from 'vitest';
import { detectAnomaliasFrete, type DetectFreteInput } from './detect';
import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';

// ---- builders mínimos ----
function frete(over: Partial<Frete>): Frete {
  return {
    id: 'f1', data: '2026-01-10', dataChegada: '2026-01-11', obraId: 'o1',
    origem: 'Britam', destino: 'Obra', transportadora: 'Areacre', insumoId: 'brita4',
    pesoToneladas: 30, kmRodados: 0, valorTkm: 0, valorTotal: 1000, notaFiscal: 'NF1',
    notaFiscal2: '', placaCarreta: 'ABC1D23', motorista: 'Zé', valorMaterial: 30 * 121.98,
    observacoes: '', criadoPor: '', ...over,
  } as Frete;
}
function pedido(over: Partial<PedidoMaterial>): PedidoMaterial {
  return {
    id: 'p1', data: '2026-01-01', fornecedorId: 'fBritam',
    itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }],
    observacoes: '', criadoPor: '', ...over,
  } as PedidoMaterial;
}
const fornecedores: Fornecedor[] = [{ id: 'fBritam', nome: 'Britam' } as Fornecedor];
const base = (over: Partial<DetectFreteInput>): DetectFreteInput => ({
  fretesNoPeriodo: [], fretesTodos: [], pedidos: [], fornecedores,
  insumoNome: new Map([['brita4', 'Brita 4'], ['bgs', 'BGS']]),
  fornecedorNome: new Map([['fBritam', 'Britam']]),
  hoje: '2026-06-08', ...over,
});

describe('F1 — preço de material fora do padrão', () => {
  it('dispara quando o R$/t do frete não bate com nenhum preço de pedido', () => {
    const f = frete({ id: 'fx', insumoId: 'bgs', valorMaterial: 60 * 112.35, pesoToneladas: 60 });
    const p = pedido({ itens: [{ insumoId: 'bgs', quantidade: 1000, valorUnitario: 106.73 }] });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    const f1 = res.filter((a) => a.detector === 'F1');
    expect(f1).toHaveLength(1);
    expect(f1[0].affectedFreteIds).toEqual(['fx']);
    expect(f1[0].severity).toBe('warning');
  });

  it('NÃO dispara quando o preço bate com algum pedido (ex: pico de dezembro 128,40)', () => {
    const f = frete({ id: 'fdez', valorMaterial: 30 * 128.40, pesoToneladas: 30 });
    const p = pedido({ itens: [
      { insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 },
      { insumoId: 'brita4', quantidade: 400, valorUnitario: 128.40 },
    ] });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    expect(res.filter((a) => a.detector === 'F1')).toHaveLength(0);
  });

  it('respeita a tolerância de R$0,10/t', () => {
    const f = frete({ valorMaterial: 30 * 122.05, pesoToneladas: 30 }); // 122,05 vs 121,98 = 0,07
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F1')).toHaveLength(0);
  });
});

describe('F2 — frete de material sem pedido', () => {
  it('dispara quando o material+fornecedor não tem pedido', () => {
    const f = frete({ id: 'fnp', insumoId: 'bgs', origem: 'Britam' });
    const p = pedido({ itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }] }); // só brita4
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [p] }));
    const f2 = res.filter((a) => a.detector === 'F2');
    expect(f2).toHaveLength(1);
    expect(f2[0].affectedFreteIds).toEqual(['fnp']);
    // F1 não dispara pro mesmo frete (sem pedido)
    expect(res.filter((a) => a.detector === 'F1' && a.affectedFreteIds.includes('fnp'))).toHaveLength(0);
  });

  it('NÃO dispara quando há pedido do material+fornecedor', () => {
    const f = frete({ id: 'fok', insumoId: 'brita4' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F2')).toHaveLength(0);
  });
});

describe('F3 — saldo negativo na pedreira', () => {
  it('dispara quando transportado (t) > pedido (t) por material+fornecedor', () => {
    const fretes = [
      frete({ id: 'a', insumoId: 'brita4', pesoToneladas: 700 }),
      frete({ id: 'b', insumoId: 'brita4', pesoToneladas: 500 }),
    ];
    const p = pedido({ itens: [{ insumoId: 'brita4', quantidade: 1000, valorUnitario: 121.98 }] }); // 1000 < 1200
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [p] }));
    const f3 = res.filter((a) => a.detector === 'F3');
    expect(f3).toHaveLength(1);
    expect(f3[0].affectedInsumoId).toBe('brita4');
    expect(f3[0].affectedFornecedorId).toBe('fBritam');
  });

  it('NÃO dispara quando transportado <= pedido', () => {
    const fretes = [frete({ id: 'a', insumoId: 'brita4', pesoToneladas: 800 })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F3')).toHaveLength(0);
  });
});

describe('F4 — frete duplicado', () => {
  it('dispara quando a mesma nota fiscal aparece em 2+ fretes', () => {
    const fretes = [frete({ id: 'a', notaFiscal: '999' }), frete({ id: 'b', notaFiscal: '999' })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    const f4 = res.filter((a) => a.detector === 'F4');
    expect(f4).toHaveLength(1);
    expect(f4[0].severity).toBe('critical');
    expect(new Set(f4[0].affectedFreteIds)).toEqual(new Set(['a', 'b']));
  });

  it('dispara por placa+peso+material+data repetidos (mesmo sem nota igual)', () => {
    const fretes = [
      frete({ id: 'a', notaFiscal: 'N1', placaCarreta: 'XYZ9Z99', pesoToneladas: 31, data: '2026-02-02' }),
      frete({ id: 'b', notaFiscal: 'N2', placaCarreta: 'XYZ9Z99', pesoToneladas: 31, data: '2026-02-02' }),
    ];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F4').length).toBeGreaterThanOrEqual(1);
  });

  it('NÃO dispara com notas e cargas distintas', () => {
    const fretes = [frete({ id: 'a', notaFiscal: 'N1' }), frete({ id: 'b', notaFiscal: 'N2', placaCarreta: 'OUT0R00', pesoToneladas: 25 })];
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: fretes, fretesTodos: fretes, pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F4')).toHaveLength(0);
  });
});

describe('F5 — cadastro incompleto', () => {
  it('warning quando falta peso ou valor de material', () => {
    const f = frete({ id: 'sp', pesoToneladas: 0, valorMaterial: 0 });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    const f5 = res.filter((a) => a.detector === 'F5');
    expect(f5).toHaveLength(1);
    expect(f5[0].severity).toBe('warning');
  });

  it('info quando só falta nota fiscal ou placa', () => {
    const f = frete({ id: 'snf', notaFiscal: '', placaCarreta: '' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    const f5 = res.filter((a) => a.detector === 'F5');
    expect(f5).toHaveLength(1);
    expect(f5[0].severity).toBe('info');
  });

  it('dispara quando a origem não casa com nenhum fornecedor', () => {
    const f = frete({ id: 'sof', origem: 'Pedreira Inexistente' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F5' && a.affectedFreteIds.includes('sof'))).toHaveLength(1);
  });

  it('NÃO dispara para frete completo', () => {
    const f = frete({ id: 'ok' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})] }));
    expect(res.filter((a) => a.detector === 'F5')).toHaveLength(0);
  });
});

describe('F6 — frete sem chegada', () => {
  it('dispara quando data_chegada vazia há mais de 7 dias', () => {
    const f = frete({ id: 'nc', dataChegada: '', data: '2026-06-01' }); // hoje base = 2026-06-08 (7d) -> >7 precisa 8
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-10' }));
    const f6 = res.filter((a) => a.detector === 'F6');
    expect(f6).toHaveLength(1);
    expect(f6[0].severity).toBe('info');
  });

  it('NÃO dispara dentro de 7 dias', () => {
    const f = frete({ id: 'nc2', dataChegada: '', data: '2026-06-05' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-08' }));
    expect(res.filter((a) => a.detector === 'F6')).toHaveLength(0);
  });

  it('NÃO dispara quando já tem data de chegada', () => {
    const f = frete({ id: 'nc3', dataChegada: '2026-06-02', data: '2026-06-01' });
    const res = detectAnomaliasFrete(base({ fretesNoPeriodo: [f], fretesTodos: [f], pedidos: [pedido({})], hoje: '2026-06-30' }));
    expect(res.filter((a) => a.detector === 'F6')).toHaveLength(0);
  });
});
