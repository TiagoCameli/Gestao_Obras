import { describe, expect, it } from 'vitest';

import { acaoMigradaParaErp } from './modulosMigrados';

describe('módulos migrados para o ERP (Fase 5, só leitura)', () => {
  it('bloqueia lançar e editar de Frete, Combustível e Manutenção', () => {
    for (const chave of ['criar_frete', 'criar_pagamento_frete', 'ajustar_saldo_transportadora', 'criar_saida_combustivel',
      'saida_combustivel_mobile', 'esvaziar_tanque', 'criar_os', 'abrir_os_mobile', 'criar_entrada_almoxarifado']) {
      expect(acaoMigradaParaErp(chave)).toBe(true);
    }
  });

  it('CONTROLE: ver e exportar continuam, e o que ficou no Gestão Obras não é tocado', () => {
    for (const chave of ['ver_frete', 'exportar_frete', 'ver_combustivel', 'exportar_combustivel', 'ver_manutencao',
      'criar_entrada_material', 'criar_saida_material', 'criar_depositos_material', 'lancar_medicao_mobile',
      'editar_equipamentos', 'fechar_medicao']) {
      expect(acaoMigradaParaErp(chave)).toBe(false);
    }
  });
});
