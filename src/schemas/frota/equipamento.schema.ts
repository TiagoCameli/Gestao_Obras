import { z } from 'zod';

/**
 * Schema do form de cadastro de equipamento (Onda 5.A — RHF+Zod).
 *
 * Decisões:
 *  - codigoPatrimonio opcional aqui — required-quando-EMT é checado manualmente
 *    no isValid (cross-field via watch). Schema não conhece a empresa.
 *  - ativo é boolean (toggle separado do status); status é enum 4-way.
 *  - medicaoInicial sai como number (RHF valueAsNumber).
 *  - ano fica string (cadastro guarda como '2024' livre, não int).
 *  - Anexos (fotoUrls/arquivoUrls) ficam fora do schema (AnexosUploader).
 */
export const equipamentoFrotaFormSchema = z.object({
  nome: z.string().min(1, 'Nome obrigatório'),
  tipo: z.string().min(1, 'Selecione o tipo'),
  empresaId: z.string().min(1, 'Selecione a empresa'),
  codigoPatrimonio: z.string().optional().or(z.literal('')),
  numeroSerie: z.string().optional().or(z.literal('')),
  ano: z.string().optional().or(z.literal('')),
  marca: z.string().optional().or(z.literal('')),
  modelo: z.string().optional().or(z.literal('')),
  propriedade: z.enum(['propria', 'alugada']),
  status: z.enum(['ativa', 'manutencao_preventiva', 'manutencao_corretiva', 'fora_funcionamento']),
  tipoMedicao: z.enum(['horimetro', 'odometro']),
  medicaoInicial: z.number().nonnegative('Medição inicial ≥ 0').optional(),
  ativo: z.boolean(),
  dataAquisicao: z.string().optional().or(z.literal('')),
  dataVenda: z.string().optional().or(z.literal('')),
});

export type EquipamentoFrotaFormValues = z.infer<typeof equipamentoFrotaFormSchema>;
