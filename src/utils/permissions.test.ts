import { describe, it, expect } from 'vitest';
import { acoesPadraoDoCargo, ACOES_PLATAFORMA, DEPENDENCIAS_ACOES, TEMPLATES_ACOES_POR_CARGO } from './permissions';

const CHAVES_ENGENHARIA_TODAS = [
  'ver_engenharia',
  'criar_engenharia_pasta', 'editar_engenharia_pasta', 'excluir_engenharia_pasta',
  'criar_engenharia_nota', 'editar_engenharia_nota', 'excluir_engenharia_nota',
  'criar_engenharia_calculo', 'editar_engenharia_calculo', 'excluir_engenharia_calculo',
  'criar_engenharia_prancha', 'editar_engenharia_prancha', 'excluir_engenharia_prancha',
  'upload_engenharia_arquivo', 'excluir_engenharia_arquivo',
  'ver_lixeira_engenharia', 'restaurar_lixeira_engenharia', 'excluir_permanente_engenharia',
  'ver_historico_engenharia', 'gerenciar_locks_engenharia',
];

describe('ACOES_PLATAFORMA — Engenharia', () => {
  it('contém as 20 chaves no grupo Engenharia', () => {
    const chavesEng = ACOES_PLATAFORMA
      .filter((a) => a.grupo === 'Engenharia')
      .map((a) => a.chave);
    expect(chavesEng.sort()).toEqual([...CHAVES_ENGENHARIA_TODAS].sort());
  });

  it('todas as 20 chaves têm label não-vazio', () => {
    const acoes = ACOES_PLATAFORMA.filter((a) => a.grupo === 'Engenharia');
    for (const a of acoes) {
      expect(a.label.length).toBeGreaterThan(0);
    }
  });
});

describe('DEPENDENCIAS_ACOES — Engenharia', () => {
  it('chaves derivadas dependem de ver_engenharia (exceto restaurar/excluir_perm que dependem de ver_lixeira)', () => {
    expect(DEPENDENCIAS_ACOES.criar_engenharia_pasta).toEqual(['ver_engenharia']);
    expect(DEPENDENCIAS_ACOES.editar_engenharia_pasta).toEqual(['ver_engenharia']);
    expect(DEPENDENCIAS_ACOES.excluir_engenharia_pasta).toEqual(
      ['ver_engenharia', 'editar_engenharia_pasta'],
    );
    expect(DEPENDENCIAS_ACOES.restaurar_lixeira_engenharia).toEqual(['ver_lixeira_engenharia']);
    expect(DEPENDENCIAS_ACOES.excluir_permanente_engenharia).toEqual(
      ['ver_lixeira_engenharia', 'restaurar_lixeira_engenharia'],
    );
  });

  it('ver_engenharia NÃO tem dependência (é a raiz)', () => {
    expect(DEPENDENCIAS_ACOES.ver_engenharia).toBeUndefined();
  });
});

describe('acoesPadraoDoCargo — Engenharia', () => {
  it('Administrador recebe todas as 20 chaves de Engenharia (via TODAS_ACOES_PLATAFORMA)', () => {
    const acoes = acoesPadraoDoCargo('Administrador');
    for (const chave of CHAVES_ENGENHARIA_TODAS) {
      expect(acoes).toContain(chave);
    }
  });

  it('Engenheiro Civil Sênior recebe 19 (tudo menos excluir_permanente)', () => {
    const acoes = acoesPadraoDoCargo('Engenheiro Civil Sênior');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('restaurar_lixeira_engenharia');
    expect(acoes).toContain('gerenciar_locks_engenharia');
    expect(acoes).toContain('excluir_engenharia_pasta');
    expect(acoes).toContain('excluir_engenharia_arquivo');
    expect(acoes).toContain('criar_engenharia_prancha');
    expect(acoes).toContain('editar_engenharia_prancha');
    expect(acoes).toContain('excluir_engenharia_prancha');
    expect(acoes).not.toContain('excluir_permanente_engenharia');
  });

  it('Engenheiro Civil recebe somente criar/editar/upload (sem excluir)', () => {
    const acoes = acoesPadraoDoCargo('Engenheiro Civil');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('criar_engenharia_pasta');
    expect(acoes).toContain('editar_engenharia_nota');
    expect(acoes).toContain('upload_engenharia_arquivo');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).toContain('ver_historico_engenharia');
    expect(acoes).not.toContain('excluir_engenharia_pasta');
    expect(acoes).not.toContain('excluir_engenharia_arquivo');
    expect(acoes).not.toContain('gerenciar_locks_engenharia');
    expect(acoes).not.toContain('restaurar_lixeira_engenharia');
  });

  it('Gerente recebe somente read-only', () => {
    const acoes = acoesPadraoDoCargo('Gerente');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
    expect(acoes).not.toContain('editar_engenharia_nota');
    expect(acoes).not.toContain('upload_engenharia_arquivo');
  });

  it('Supervisor recebe somente read-only', () => {
    const acoes = acoesPadraoDoCargo('Supervisor');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
  });

  it('Gerente Financeiro recebe somente read-only', () => {
    const acoes = acoesPadraoDoCargo('Gerente Financeiro');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
  });

  it('Gerente de Compras recebe somente read-only', () => {
    const acoes = acoesPadraoDoCargo('Gerente de Compras');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
  });

  it('Financeiro recebe somente read-only', () => {
    const acoes = acoesPadraoDoCargo('Financeiro');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
  });

  it('Operador não tem acesso ao módulo', () => {
    const acoes = acoesPadraoDoCargo('Operador');
    expect(acoes).not.toContain('ver_engenharia');
  });

  it('Apontador não tem acesso ao módulo', () => {
    const acoes = acoesPadraoDoCargo('Apontador');
    expect(acoes).not.toContain('ver_engenharia');
  });
});

describe('Engenharia — chaves de prancha', () => {
  const novas = ['criar_engenharia_prancha', 'editar_engenharia_prancha', 'excluir_engenharia_prancha'];

  it('as 3 chaves de prancha existem no grupo Engenharia', () => {
    for (const chave of novas) {
      const acao = ACOES_PLATAFORMA.find((a) => a.chave === chave);
      expect(acao, chave).toBeTruthy();
      expect(acao!.grupo).toBe('Engenharia');
    }
  });

  it('dependem de ver_engenharia (e excluir depende de editar)', () => {
    expect(DEPENDENCIAS_ACOES['criar_engenharia_prancha']).toContain('ver_engenharia');
    expect(DEPENDENCIAS_ACOES['editar_engenharia_prancha']).toContain('ver_engenharia');
    expect(DEPENDENCIAS_ACOES['excluir_engenharia_prancha']).toEqual(
      expect.arrayContaining(['ver_engenharia', 'editar_engenharia_prancha']),
    );
  });

  it('Administrador tem as 3; Engenheiro Civil tem criar+editar; Operador não tem nenhuma', () => {
    for (const chave of novas) expect(TEMPLATES_ACOES_POR_CARGO.Administrador).toContain(chave);
    expect(TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil']).toEqual(
      expect.arrayContaining(['criar_engenharia_prancha', 'editar_engenharia_prancha']),
    );
    expect(TEMPLATES_ACOES_POR_CARGO.Operador).not.toContain('criar_engenharia_prancha');
  });
});
