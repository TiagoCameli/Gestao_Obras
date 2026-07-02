import { describe, it, expect } from 'vitest';
import { ACOES_PLATAFORMA, DEPENDENCIAS_ACOES, acoesPadraoDoCargo } from './permissions';

describe('permissões caderno de manutenção', () => {
  const novas = ['adicionar_terceiro_os','adicionar_oleo_os','gerenciar_tipos_oleo'];
  it('as 3 chaves existem no grupo Manutenção', () => {
    for (const c of novas) {
      const a = ACOES_PLATAFORMA.find(x => x.chave === c);
      expect(a, c).toBeTruthy();
      expect(a!.grupo).toBe('Manutenção');
    }
  });
  it('dependem de ver_manutencao', () => {
    for (const c of novas) expect(DEPENDENCIAS_ACOES[c]).toContain('ver_manutencao');
  });
  it('Administrador recebe as 3', () => {
    const a = acoesPadraoDoCargo('Administrador');
    for (const c of novas) expect(a).toContain(c);
  });
});
