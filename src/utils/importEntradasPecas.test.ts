import { describe, it, expect } from 'vitest';
import {
  criarEntradasCtx, parseRowEntrada, entradaRowToEntradaMaterial, TEMPLATE_ENTRADAS_PECAS,
} from './importEntradasPecas';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo } from '../types';

// Colunas: Depósito, Fornecedor, Nota fiscal, Data, SKU, Peça (nome), Quantidade, Valor unitário
function ctx() {
  return criarEntradasCtx(
    [
      { id: 'i1', nome: 'Filtro de Óleo 173-3511', codigoSku: 'FO-173', ativo: true, usadoEmManutencao: true },
      { id: 'i2', nome: 'Correia Sem SKU', codigoSku: '', ativo: true, usadoEmManutencao: true },
      { id: 'i3', nome: 'Peça Inativa', codigoSku: 'PI-9', ativo: false, usadoEmManutencao: true },
      { id: 'i4', nome: 'Cimento CP-II', codigoSku: 'CIM-2', ativo: true, usadoEmManutencao: false },
    ] as unknown as Insumo[],
    [
      { id: 'd1', nome: 'Almoxarifado Central', obraId: 'obra1', ativo: true },
      { id: 'd2', nome: 'Depósito Desativado', obraId: '', ativo: false },
    ] as unknown as DepositoMaterial[],
    [
      { id: 'f1', nome: 'Auto Peças Acre', ativo: true },
      { id: 'f2', nome: 'Fornecedor Inativo', ativo: false },
    ] as unknown as Fornecedor[],
    [
      { fornecedorId: 'f1', notaFiscal: '111' },
      { fornecedorId: 'f1', notaFiscal: '222', deletadoEm: '2026-01-01T00:00:00Z' },
    ] as unknown as EntradaMaterial[]
  );
}

const ROW_OK = ['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '10', '38,50'];

describe('parseRowEntrada', () => {
  it('linha válida com SKU resolve ids e números', () => {
    const r = parseRowEntrada(ROW_OK, 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.erros).toEqual([]);
    expect(r.dados.depositoId).toBe('d1');
    expect(r.dados.obraId).toBe('obra1');
    expect(r.dados.fornecedorId).toBe('f1');
    expect(r.dados.insumoId).toBe('i1');
    expect(r.dados.notaFiscal).toBe('123');
    expect(r.dados.data).toBe('2026-07-06');
    expect(r.dados.quantidade).toBe(10);
    expect(r.dados.valorUnitario).toBe(38.5);
    expect(r.resumo).toContain('123');
    expect(r.resumo).toContain('Filtro de Óleo 173-3511');
  });

  it('SKU vazio casa pelo nome exato (case-insensitive)', () => {
    const r = parseRowEntrada(['almoxarifado central', 'AUTO PEÇAS ACRE', '123', '06/07/2026', '', 'correia sem sku', '2', '10'], 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.dados.insumoId).toBe('i2');
  });

  it('SKU inexistente é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'XX-999', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não encontrad/i);
  });

  it('nome inexistente (sem SKU) é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', 'Peça Fantasma', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não encontrad/i);
  });

  it('sem SKU e sem nome é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/informe sku ou nome/i);
  });

  it('peça inativa ou fora da manutenção não casa', () => {
    const inativa = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'PI-9', '', '1', '1'], 0, ctx());
    expect(inativa.valido).toBe(false);
    const foraManut = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'CIM-2', '', '1', '1'], 0, ctx());
    expect(foraManut.valido).toBe(false);
  });

  it('depósito inexistente ou inativo é inválida', () => {
    const naoAchou = parseRowEntrada(['Depósito X', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(naoAchou.valido).toBe(false);
    expect(naoAchou.erros.join(' ')).toMatch(/depósito/i);
    const inativo = parseRowEntrada(['Depósito Desativado', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(inativo.valido).toBe(false);
  });

  it('fornecedor inexistente ou inativo é inválida', () => {
    const naoAchou = parseRowEntrada(['Almoxarifado Central', 'Fornecedor X', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(naoAchou.valido).toBe(false);
    expect(naoAchou.erros.join(' ')).toMatch(/fornecedor/i);
    const inativo = parseRowEntrada(['Almoxarifado Central', 'Fornecedor Inativo', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(inativo.valido).toBe(false);
  });

  it('NF vazia é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/nota fiscal/i);
  });

  it('data vazia ou inválida é inválida; serial do Excel funciona', () => {
    const vazia = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '', 'FO-173', '', '1', '1'], 0, ctx());
    expect(vazia.valido).toBe(false);
    expect(vazia.erros.join(' ')).toMatch(/data/i);
    const lixo = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', 'amanhã', 'FO-173', '', '1', '1'], 0, ctx());
    expect(lixo.valido).toBe(false);
    // serial 45000 = 15/03/2023
    const serial = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', 45000, 'FO-173', '', '1', '1'], 0, ctx());
    expect(serial.valido).toBe(true);
    expect(serial.dados.data).toBe('2023-03-15');
  });

  it('quantidade precisa ser > 0', () => {
    const zero = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '0', '1'], 0, ctx());
    expect(zero.valido).toBe(false);
    expect(zero.erros.join(' ')).toMatch(/quantidade/i);
    const vazia = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '', '1'], 0, ctx());
    expect(vazia.valido).toBe(false);
  });

  it('valor unitário vazio é inválido; zero é válido', () => {
    const vazio = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', ''], 0, ctx());
    expect(vazio.valido).toBe(false);
    expect(vazio.erros.join(' ')).toMatch(/valor/i);
    const zero = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '0'], 0, ctx());
    expect(zero.valido).toBe(true);
    expect(zero.dados.valorUnitario).toBe(0);
  });

  it('NF já lançada no banco bloqueia a linha', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '111', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já lançada/i);
  });

  it('NF de entrada soft-deletada não bloqueia', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '222', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(true);
  });

  it('mesma NF com peças diferentes no arquivo: ambas válidas', () => {
    const c = ctx();
    const r1 = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, c);
    const r2 = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', 'Correia Sem SKU', '1', '1'], 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(true);
  });

  it('mesma NF + mesma peça repetida no arquivo: 2ª ocorrência inválida', () => {
    const c = ctx();
    const r1 = parseRowEntrada(ROW_OK, 0, c);
    const r2 = parseRowEntrada(ROW_OK, 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(false);
    expect(r2.erros.join(' ')).toMatch(/repetida/i);
  });

  it('linha inválida não registra a chave: linha corrigida depois é válida', () => {
    const c = ctx();
    const invalida = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '0', '1'], 0, c);
    expect(invalida.valido).toBe(false);
    const corrigida = parseRowEntrada(ROW_OK, 1, c);
    expect(corrigida.valido).toBe(true);
  });

  it('index 0 reseta o acumulador do arquivo (novo upload)', () => {
    const c = ctx();
    parseRowEntrada(ROW_OK, 0, c);
    const r = parseRowEntrada(ROW_OK, 0, c);
    expect(r.valido).toBe(true);
  });
});

describe('entradaRowToEntradaMaterial', () => {
  it('monta EntradaMaterial com total calculado e dia preservado', () => {
    const dados = {
      depositoId: 'd1', obraId: 'obra1', fornecedorId: 'f1', notaFiscal: '123',
      data: '2026-07-06', insumoId: 'i1', quantidade: 10, valorUnitario: 38.5,
    };
    const e = entradaRowToEntradaMaterial(dados, 'Tiago');
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
    expect(e.depositoMaterialId).toBe('d1');
    expect(e.obraId).toBe('obra1');
    expect(e.fornecedorId).toBe('f1');
    expect(e.insumoId).toBe('i1');
    expect(e.notaFiscal).toBe('123');
    expect(e.quantidade).toBe(10);
    expect(e.valorUnitario).toBe(38.5);
    expect(e.valorTotal).toBe(385);
    expect(e.criadoPor).toBe('Tiago');
    expect(e.observacoes).toBe('');
    // dia gravado = dia da planilha, no fuso local (regra wall-clock)
    expect(new Date(e.dataHora).toLocaleDateString('sv-SE')).toBe('2026-07-06');
  });
});

describe('TEMPLATE_ENTRADAS_PECAS', () => {
  it('tem 8 colunas com Depósito primeiro', () => {
    expect(TEMPLATE_ENTRADAS_PECAS.headers.length).toBe(8);
    expect(TEMPLATE_ENTRADAS_PECAS.headers[0]).toBe('Depósito');
    expect(TEMPLATE_ENTRADAS_PECAS.exemplo.length).toBe(8);
    expect(TEMPLATE_ENTRADAS_PECAS.colWidths.length).toBe(8);
  });
});
