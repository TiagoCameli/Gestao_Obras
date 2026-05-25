import { z } from 'zod';
import { CARGOS } from '../../utils/permissions';

/**
 * Schema do form de funcionário/usuário (Onda 5.B — RHF+Zod).
 *
 * Decisões:
 *  - CPF/telefone/CEP são opcionais (campos formatados via onChange custom).
 *  - dataNascimento opcional; idade >= 18 checada em refine quando preenchida.
 *  - senha + confirmarSenha opcionais (UI tem toggle "alterar senha" em
 *    modo edit; em modo create, handler força requerido). refine compara
 *    igualdade quando ambas preenchidas.
 *  - Endereço: todos os campos opcionais (não tem regra obrigatória).
 *  - status: 'ativo' | 'inativo'.
 *  - cargo: enum derivado da lista CARGOS de permissions.
 *  - Validações cross-field complexas (email já cadastrado, auto-protection
 *    do Admin, último Admin) ficam no submit handler do componente.
 *
 *  acoesPermitidas NÃO é schema — fica em useState (cascade + grupo +
 *  dependencies precisam de UI logic).
 */

function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(digits[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(digits[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(digits[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(digits[10]);
}

const cargosEnum = CARGOS.map((c) => c.valor) as [string, ...string[]];

export const funcionarioFormSchema = z.object({
  // ── Dados pessoais ──
  nome: z.string().min(1, 'Nome obrigatório'),
  email: z.string().min(1, 'E-mail obrigatório').email('E-mail inválido'),
  cpf: z.string().optional().or(z.literal('')).refine(
    (v) => !v || validarCPF(v),
    { message: 'CPF inválido' },
  ),
  telefone: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')).refine(
    (v) => {
      if (!v) return true;
      const nasc = new Date(v);
      const idade = (Date.now() - nasc.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return idade >= 18;
    },
    { message: 'Funcionário deve ter pelo menos 18 anos' },
  ),
  cargo: z.enum(cargosEnum, { error: 'Selecione o cargo' }),
  dataAdmissao: z.string().optional().or(z.literal('')),
  status: z.enum(['ativo', 'inativo']),
  observacoes: z.string().optional().or(z.literal('')),

  // ── Endereço (todos opcionais) ──
  enderecoRua: z.string().optional().or(z.literal('')),
  enderecoNumero: z.string().optional().or(z.literal('')),
  enderecoComplemento: z.string().optional().or(z.literal('')),
  enderecoBairro: z.string().optional().or(z.literal('')),
  enderecoCidade: z.string().optional().or(z.literal('')),
  enderecoEstado: z.string().optional().or(z.literal('')),
  enderecoCep: z.string().optional().or(z.literal('')),

  // ── Senha (validação condicional fica no submit handler) ──
  senha: z.string().optional().or(z.literal('')),
  confirmarSenha: z.string().optional().or(z.literal('')),
}).refine(
  (data) => !data.senha || data.senha === data.confirmarSenha,
  { message: 'As senhas não conferem', path: ['confirmarSenha'] },
).refine(
  (data) => !data.senha || data.senha.length >= 6,
  { message: 'A senha deve ter pelo menos 6 caracteres', path: ['senha'] },
);

export type FuncionarioFormValues = z.infer<typeof funcionarioFormSchema>;
