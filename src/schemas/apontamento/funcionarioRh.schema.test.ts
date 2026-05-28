import { describe, it, expect } from 'vitest';
import { funcionarioRhFormSchema } from './funcionarioRh.schema';

const base = {
  nome: 'João da Silva',
  cpf: '',
  rg: '',
  pis: '',
  ctps: '',
  dataNascimento: '',
  funcao: '',
  tipoVinculo: 'CLT' as const,
  dataAdmissao: '2026-01-10',
  dataDemissao: '',
  status: 'ativo' as const,
  contatoEmergencia: '',
};

describe('funcionarioRhFormSchema — salarioBase opcional', () => {
  it('aceita cadastro sem salário (campo vazio vira undefined via setValueAs)', () => {
    const r = funcionarioRhFormSchema.safeParse({ ...base, salarioBase: undefined });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.salarioBase).toBeUndefined();
  });

  it('aceita cadastro sem o campo salarioBase presente', () => {
    const r = funcionarioRhFormSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it('aceita salário válido (> 0)', () => {
    const r = funcionarioRhFormSchema.safeParse({ ...base, salarioBase: 1518 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.salarioBase).toBe(1518);
  });

  it('rejeita salário <= 0 quando preenchido', () => {
    expect(funcionarioRhFormSchema.safeParse({ ...base, salarioBase: 0 }).success).toBe(false);
    expect(funcionarioRhFormSchema.safeParse({ ...base, salarioBase: -5 }).success).toBe(false);
  });

  it('continua exigindo nome', () => {
    const r = funcionarioRhFormSchema.safeParse({ ...base, nome: '', salarioBase: undefined });
    expect(r.success).toBe(false);
  });
});
