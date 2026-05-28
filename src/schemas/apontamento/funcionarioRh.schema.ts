import { z } from 'zod';
import { isCpfValido, FUNCOES } from '../../modules/apontamento/types/funcionario';

/**
 * Schema do form de funcionário do módulo Apontamento RH (Onda 5.C).
 *
 * Decisões:
 *  - Único obrigatório: nome. salarioBase opcional (se preenchido, > 0).
 *  - CPF opcional; quando preenchido, valida dígitos (isCpfValido).
 *  - Duplicidade de CPF é cross-field assíncrono (API existeCpf) — fica
 *    no submit handler do componente.
 *  - fotos[] e documentos[] em useState fora do RHF (uploads assíncronos).
 *  - funcao usa enum derivado de FUNCOES; aceita vazio (FuncaoFuncionario
 *    é union com "").
 */

const funcoesEnum = ['', ...FUNCOES] as readonly string[];

export const funcionarioRhFormSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  cpf: z.string().optional().or(z.literal('')).refine(
    (v) => {
      if (!v) return true;
      const digits = v.replace(/\D/g, '');
      return digits === '' || isCpfValido(digits);
    },
    { message: 'CPF inválido' },
  ),
  rg: z.string().optional().or(z.literal('')),
  pis: z.string().optional().or(z.literal('')),
  ctps: z.string().optional().or(z.literal('')),
  dataNascimento: z.string().optional().or(z.literal('')),

  funcao: z.enum(funcoesEnum as [string, ...string[]]),
  tipoVinculo: z.enum(['CLT', 'prestador_servico', 'terceirizado', 'MEI']),
  // Opcional. Campo vazio vira undefined no register (setValueAs); quando
  // preenchido, ainda precisa ser > 0.
  salarioBase: z.number().positive('Salário deve ser > 0').optional(),

  dataAdmissao: z.string().min(1, 'Data de admissão obrigatória'),
  dataDemissao: z.string().optional().or(z.literal('')),
  status: z.enum(['ativo', 'inativo', 'afastado', 'demitido']),
  contatoEmergencia: z.string().optional().or(z.literal('')),
});

export type FuncionarioRhFormValues = z.infer<typeof funcionarioRhFormSchema>;
