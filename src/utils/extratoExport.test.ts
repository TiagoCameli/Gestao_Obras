import { describe, it, expect } from 'vitest';
import { placaMovimento, formatBreakdown, montarExtratoWorkbook } from './extratoExport';
import { fmtBRL } from './exportTemplate';
import type { TransportadoraMovimento } from '../types';

function mov(over: Partial<TransportadoraMovimento>): TransportadoraMovimento {
  return {
    id: 'm1',
    transportadoraId: 't1',
    data: '2026-05-01T10:00:00Z',
    tipo: 'credito_frete',
    valor: 100,
    origemTabela: 'fretes',
    origemId: 'o1',
    descricao: null,
    obraId: null,
    mesReferencia: '2026-05-01',
    abatidoEmPagamentoId: null,
    createdAt: '2026-05-01T10:00:00Z',
    createdBy: null,
    ...over,
  };
}

describe('placaMovimento', () => {
  it('frete usa a placa da carreta do frete', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: 'ABC1D23' }))).toBe('ABC1D23');
  });

  it('abastecimentos (transterra/emt/crédito tanque) usam a placa da saída', () => {
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_transterra', saidaPlaca: 'DEF4G56' }))).toBe('DEF4G56');
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_emt', saidaPlaca: 'GHI7J89' }))).toBe('GHI7J89');
    expect(placaMovimento(mov({ tipo: 'credito_abastecimento_transterra', saidaPlaca: 'JKL0M12' }))).toBe('JKL0M12');
  });

  it('pagamentos e ajustes manuais não têm carreta → null', () => {
    expect(placaMovimento(mov({ tipo: 'debito_pagamento_frete' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'ajuste_manual_credito' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'ajuste_manual_debito' }))).toBeNull();
  });

  it('placa ausente, vazia ou só espaços vira null', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: null }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: '' }))).toBeNull();
    expect(placaMovimento(mov({ tipo: 'debito_abastecimento_emt', saidaPlaca: '   ' }))).toBeNull();
  });

  it('faz trim da placa', () => {
    expect(placaMovimento(mov({ tipo: 'credito_frete', fretePlacaCarreta: '  ABC1D23 ' }))).toBe('ABC1D23');
  });
});

// ────────────────────────────────────────────────────────────────────
// formatBreakdown — a memória de cálculo TEM que reproduzir o valor
// lançado. Caso real (26/08/2026): abastecimento de 725 L em tanque EMT
// aparecia como "725 L × R$ 6,3300/L (preço médio do tanque) = R$ 4.589,25"
// enquanto o débito real era R$ 4.930,00 — porque o débito usa o preço
// COBRADO DA TRANSPORTADORA (R$ 6,80), não o custo médio do tanque.
// ────────────────────────────────────────────────────────────────────
describe('formatBreakdown — preço do combustível', () => {
  const abastecimentoEmt = {
    tipo: 'debito_abastecimento_emt' as const,
    valor: 4930,
    saidaLitros: 725,
    saidaPrecoCombustivel: 6.8,   // cobrado da transportadora
    saidaPrecoMedioTanque: 6.33,  // custo FIFO do tanque — NÃO é o que se cobra
    saidaTaxaLitro: 0,
  };

  it('tanque EMT usa o preço cobrado da transportadora, não o médio do tanque', () => {
    const texto = formatBreakdown(mov(abastecimentoEmt));
    expect(texto).toContain('6,8000');
    expect(texto).not.toContain('6,3300');
  });

  it('o total escrito na memória bate com o valor lançado', () => {
    const texto = formatBreakdown(mov(abastecimentoEmt));
    expect(texto).toContain(fmtBRL(4930));
    expect(texto).not.toContain(fmtBRL(4589.25));
  });

  it('tanque externo continua usando o preço cobrado (não regrediu)', () => {
    const texto = formatBreakdown(mov({
      tipo: 'debito_abastecimento_transterra',
      valor: 1360,
      saidaLitros: 200,
      saidaPrecoCombustivel: 6.8,
      saidaTaxaLitro: 0,
    }));
    expect(texto).toContain('6,8000');
    expect(texto).toContain(fmtBRL(1360));
  });

  it('soma a taxa por litro quando existe', () => {
    const texto = formatBreakdown(mov({
      tipo: 'debito_abastecimento_emt',
      valor: 1000,
      saidaLitros: 100,
      saidaPrecoCombustivel: 9,
      saidaPrecoMedioTanque: 6,
      saidaTaxaLitro: 1,
    }));
    expect(texto).toContain(fmtBRL(1000)); // 100 × (9 + 1)
    expect(texto).not.toContain('6,0000');
  });

  it('litros fracionários aparecem com 2 casas (senão a conta não reproduz)', () => {
    // 330,14 L × R$ 6,80 = R$ 2.244,95. Escrito como "330 L" a multiplicação
    // dá R$ 2.244,00 e quem confere acha que há erro.
    const texto = formatBreakdown(mov({
      tipo: 'debito_abastecimento_transterra',
      valor: 2244.952,
      saidaLitros: 330.14,
      saidaPrecoCombustivel: 6.8,
      saidaTaxaLitro: 0,
    }));
    expect(texto).toContain('330,14');
  });

  it('frete não foi afetado', () => {
    const texto = formatBreakdown(mov({
      tipo: 'credito_frete',
      valor: 12545.7,
      fretePesoToneladas: 46.5,
      freteKmRodados: 710,
      freteValorTkm: 0.38,
    }));
    expect(texto).toContain('46,50 t');
    expect(texto).toContain(fmtBRL(12545.7));
  });
});

// ────────────────────────────────────────────────────────────────────
// Fórmulas no Excel. Regra do projeto: planilha usável sozinha — todo
// valor DERIVADO aponta para as células de entrada, nada de número
// chumbado. Os dados abaixo são os reais do extrato da Andrade
// Transporte de julho/2026 que motivou o pedido.
// ────────────────────────────────────────────────────────────────────
describe('montarExtratoWorkbook — fórmulas', () => {
  const movimentos: TransportadoraMovimento[] = [
    mov({
      id: 'f1', tipo: 'credito_frete', valor: 12545.7, data: '2026-07-31T12:00:00Z',
      fretePesoToneladas: 46.5, freteKmRodados: 710, freteValorTkm: 0.38,
      freteNotaFiscal: '57666', freteOrigem: 'Pedreira Britam', freteDestino: 'Usina Gregorio',
    }),
    mov({
      id: 'a1', tipo: 'debito_abastecimento_emt', valor: 4930, data: '2026-07-29T12:00:00Z',
      saidaLitros: 725, saidaPrecoCombustivel: 6.8, saidaPrecoMedioTanque: 6.33, saidaTaxaLitro: 0,
    }),
    mov({
      id: 'a2', tipo: 'debito_abastecimento_transterra', valor: 1360, data: '2026-07-27T12:00:00Z',
      saidaLitros: 200, saidaPrecoCombustivel: 6.8, saidaTaxaLitro: 0,
    }),
  ];
  const filtros = { meses: [], tipos: [], busca: '' } as never;

  function celula(wb: ReturnType<typeof montarExtratoWorkbook>, aba: string, ref: string) {
    return wb.getWorksheet(aba)!.getCell(ref).value as { formula?: string; result?: number } | number | string;
  }
  function formulaDe(wb: ReturnType<typeof montarExtratoWorkbook>, aba: string, ref: string): string {
    const v = celula(wb, aba, ref);
    if (v && typeof v === 'object' && 'formula' in v) return v.formula!;
    throw new Error(`${aba}!${ref} não é fórmula, é ${JSON.stringify(v)}`);
  }

  const wb = montarExtratoWorkbook('Andrade Transporte', movimentos, filtros);

  it('Fretes: Valor é Peso × KM × R$/tkm, não número chumbado', () => {
    expect(formulaDe(wb, 'Fretes', 'M2')).toBe('F2*G2*H2');
    // A entrada continua número — é o que a fórmula referencia.
    expect(celula(wb, 'Fretes', 'F2')).toBe(46.5);
    expect(celula(wb, 'Fretes', 'G2')).toBe(710);
  });

  it('Fretes: o resultado em cache bate com o valor lançado', () => {
    const v = celula(wb, 'Fretes', 'M2') as { result: number };
    expect(v.result).toBeCloseTo(12545.7, 2);
  });

  it('Abastecimentos: Total é Litros × (Preço + Taxa)', () => {
    expect(formulaDe(wb, 'Abastecimentos', 'J2')).toBe('D2*(E2+F2)');
  });

  it('Abastecimentos: Preço/L é o cobrado da transportadora, não o médio do tanque', () => {
    // Linha do abastecimento EMT de 725 L: 6,80 (cobrado), nunca 6,33 (FIFO).
    const linhaEmt = movimentos.findIndex((m) => m.id === 'a1');
    const precos = [2, 3].map((r) => celula(wb, 'Abastecimentos', `E${r}`));
    expect(precos).toContain(6.8);
    expect(precos).not.toContain(6.33);
    expect(linhaEmt).toBeGreaterThanOrEqual(0);
  });

  it('Abastecimentos: rodapé traz o preço médio ponderado como fórmula', () => {
    // (4930 + 1360) / (725 + 200) = R$ 6,80/L
    const f = formulaDe(wb, 'Abastecimentos', 'E4');
    expect(f).toContain('J4/D4');
    const v = celula(wb, 'Abastecimentos', 'E4') as { result: number };
    expect(v.result).toBeCloseTo(6.8, 4);
  });

  it('Todos: o saldo é uma corrente — cada linha soma a de baixo', () => {
    // 3 linhas de dados (2..4). A última parte do zero.
    expect(formulaDe(wb, 'Todos', 'G2')).toBe('G3+SUM(E2)-SUM(F2)');
    expect(formulaDe(wb, 'Todos', 'G3')).toBe('G4+SUM(E3)-SUM(F3)');
    expect(formulaDe(wb, 'Todos', 'G4')).toBe('SUM(E4)-SUM(F4)');
  });

  it('Todos: usa SUM() nas células de crédito/débito porque as vazias são texto', () => {
    // E5-F5 com string vazia daria #VALUE! no Excel.
    expect(formulaDe(wb, 'Todos', 'G2')).toContain('SUM(E2)');
    expect(formulaDe(wb, 'Todos', 'G2')).not.toMatch(/[^M]E2-/);
  });

  it('Resumo: KPIs apontam para a aba Todos em vez de repetir número', () => {
    const ws = wb.getWorksheet('Resumo')!;
    let achouCreditos = false;
    ws.eachRow((linha) => {
      linha.eachCell((c) => {
        const v = c.value;
        if (v && typeof v === 'object' && 'formula' in v && String(v.formula).includes('Todos!E2:E4')) {
          achouCreditos = true;
        }
      });
    });
    expect(achouCreditos).toBe(true);
  });

  it('o arquivo tem fórmulas de verdade em quantidade', () => {
    let comFormula = 0;
    wb.eachSheet((ws) => {
      ws.eachRow((linha) => {
        linha.eachCell((c) => {
          if (c.value && typeof c.value === 'object' && 'formula' in c.value) comFormula++;
        });
      });
    });
    // O extrato que motivou o pedido tinha ZERO. Linha de controle.
    expect(comFormula).toBeGreaterThan(20);
  });

  it('lista vazia não gera fórmula com intervalo inválido', () => {
    const vazio = montarExtratoWorkbook('Sem Nada', [], filtros);
    vazio.eachSheet((ws) => {
      ws.eachRow((linha) => {
        linha.eachCell((c) => {
          const v = c.value;
          if (v && typeof v === 'object' && 'formula' in v) {
            // Nada de SUM(E2:E1) — intervalo invertido quebra o arquivo.
            expect(String(v.formula)).not.toMatch(/\d+:[A-Z]+1\)/);
          }
        });
      });
    });
  });
});
