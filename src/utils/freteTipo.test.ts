import { describe, it, expect } from 'vitest';
import {
  tipoDoFrete,
  ehTransferencia,
  ehFreteDePedreira,
  apenasFretesDePedreira,
  TIPO_FRETE_LABEL,
} from './freteTipo';

describe('tipoDoFrete', () => {
  it('lê transferência quando marcada', () => {
    expect(tipoDoFrete({ tipo: 'transferencia' })).toBe('transferencia');
  });

  it('lê material quando marcado', () => {
    expect(tipoDoFrete({ tipo: 'material' })).toBe('material');
  });

  it('trata frete legado (sem o campo) como material', () => {
    // 757 fretes em produção nasceram antes da coluna existir. Se caíssem em
    // "desconhecido" e fossem excluídos, o saldo de todas as pedreiras zerava.
    expect(tipoDoFrete({})).toBe('material');
    expect(tipoDoFrete({ tipo: null })).toBe('material');
    expect(tipoDoFrete({ tipo: undefined })).toBe('material');
    expect(tipoDoFrete(undefined)).toBe('material');
  });

  it('trata valor desconhecido como material, não como transferência', () => {
    expect(tipoDoFrete({ tipo: 'qualquer-coisa' })).toBe('material');
  });
});

describe('ehTransferencia / ehFreteDePedreira', () => {
  it('são opostos', () => {
    const t = { tipo: 'transferencia' as const };
    const m = { tipo: 'material' as const };
    expect(ehTransferencia(t)).toBe(true);
    expect(ehFreteDePedreira(t)).toBe(false);
    expect(ehTransferencia(m)).toBe(false);
    expect(ehFreteDePedreira(m)).toBe(true);
  });
});

describe('apenasFretesDePedreira', () => {
  it('remove transferências e preserva a ordem dos demais', () => {
    const fretes = [
      { id: 'a', tipo: 'material' as const },
      { id: 'b', tipo: 'transferencia' as const },
      { id: 'c' },
      { id: 'd', tipo: 'transferencia' as const },
      { id: 'e', tipo: 'material' as const },
    ];
    expect(apenasFretesDePedreira(fretes).map((f) => f.id)).toEqual(['a', 'c', 'e']);
  });

  it('devolve lista vazia quando tudo é transferência', () => {
    expect(apenasFretesDePedreira([{ tipo: 'transferencia' as const }])).toEqual([]);
  });

  it('não muda nada quando não há transferência (regressão do legado)', () => {
    const fretes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(apenasFretesDePedreira(fretes)).toHaveLength(3);
  });
});

describe('TIPO_FRETE_LABEL', () => {
  it('rotula em português', () => {
    expect(TIPO_FRETE_LABEL.material).toBe('Material');
    expect(TIPO_FRETE_LABEL.transferencia).toBe('Transferência');
  });
});
