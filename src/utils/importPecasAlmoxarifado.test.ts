import { describe, it, expect } from 'vitest';
import { criarDedupCtx, parseRowPeca, pecaRowToInsumo, TEMPLATE_PECAS } from './importPecasAlmoxarifado';

// ordem das colunas: Nome, Unidade, SKU, EAN, Fabricante, Part number,
// Estoque mínimo, Estoque máximo, Lead time, Equipamentos compatíveis, Aplicação técnica
function ctx() {
  return criarDedupCtx([
    { nome: 'Filtro de Óleo 173-3511', codigoSku: 'FO-173' },
    { nome: 'Correia Sem SKU', codigoSku: '' },
  ]);
}

describe('parseRowPeca', () => {
  it('linha válida vira ParsedRow válido', () => {
    const r = parseRowPeca(['Óleo Motor 15W40', 'L', 'OL-15W40', '', 'Cat', '9X-7551', '4', '20', '7', 'Escavadeira, Pá', 'motor diesel'], 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.erros).toEqual([]);
    expect(r.resumo).toContain('Óleo Motor 15W40');
    expect(r.dados.nome).toBe('Óleo Motor 15W40');
    expect(r.dados.estoqueMinimo).toBe(4);
    expect(r.dados.equipamentosCompativeis).toEqual(['Escavadeira', 'Pá']);
  });

  it('sem nome é inválida', () => {
    const r = parseRowPeca(['', 'un', 'X-1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/nome/i);
  });

  it('SKU já existente no catálogo é inválida', () => {
    const r = parseRowPeca(['Qualquer nome', 'un', 'FO-173'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já existe/i);
  });

  it('nome já existente (SKU vazio) é inválida', () => {
    const r = parseRowPeca(['Correia Sem SKU', 'un', ''], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já existe/i);
  });

  it('duplicado dentro do arquivo é inválido (2ª ocorrência)', () => {
    const c = ctx();
    const r1 = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    const r2 = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(false);
    expect(r2.erros.join(' ')).toMatch(/repetida/i);
  });

  it('index 0 reseta o acumulador do arquivo (novo upload)', () => {
    const c = ctx();
    parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    const r = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    expect(r.valido).toBe(true);
  });

  it('unidade vazia cai no default un', () => {
    const r = parseRowPeca(['Peça X', '', 'PX-1'], 0, ctx());
    expect(r.dados.unidade).toBe('un');
  });
});

describe('pecaRowToInsumo', () => {
  it('monta Insumo com flags de peça de manutenção', () => {
    const dados = { nome: 'Peça X', unidade: 'un', codigoSku: 'PX-1', codigoEan: '', fabricante: '', codigoFabricante: '', estoqueMinimo: null, estoqueMaximo: null, leadTimeDias: null, equipamentosCompativeis: [], aplicacaoTecnica: '' };
    const insumo = pecaRowToInsumo(dados, 'Tiago');
    expect(insumo.tipo).toBe('peca');
    expect(insumo.usadoEmManutencao).toBe(true);
    expect(insumo.ativo).toBe(true);
    expect(insumo.criadoPor).toBe('Tiago');
    expect(insumo.nome).toBe('Peça X');
    expect(typeof insumo.id).toBe('string');
    expect(insumo.id.length).toBeGreaterThan(0);
  });
});

describe('TEMPLATE_PECAS', () => {
  it('tem 11 colunas com Nome primeiro', () => {
    expect(TEMPLATE_PECAS.headers.length).toBe(11);
    expect(TEMPLATE_PECAS.headers[0]).toBe('Nome');
    expect(TEMPLATE_PECAS.exemplo.length).toBe(11);
    expect(TEMPLATE_PECAS.colWidths.length).toBe(11);
  });
});
