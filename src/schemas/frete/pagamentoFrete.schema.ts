import { z } from 'zod';

/**
 * Schema do form de pagamento de frete (Onda 4.B — RHF+Zod).
 *
 * Decisões:
 *  - mesReferencia/valor são opcionais no schema porque no modo "dividir
 *    entre meses" eles vêm do array `parcelas` (gerenciado fora do RHF).
 *    Validação obrigatória deles fica no submit handler quando dividir=false.
 *  - quantidadeCombustivel só é obrigatório quando metodo='combustivel' —
 *    validação cross-field via refine().
 *  - responsavel é readonly (preenchido do usuário logado), validado mesmo
 *    assim pra catch de bug.
 *  - Anexos (fotos + arquivos) não no schema — AnexosUploader gerencia.
 *  - parcelas (modo dividir) não no schema — validados manualmente.
 */
export const pagamentoFreteFormSchema = z.object({
  data: z.string().min(1, 'Data do pagamento obrigatória'),
  transportadora: z.string().min(1, 'Selecione a transportadora'),
  mesReferencia: z.string().optional().or(z.literal('')),
  valor: z.number().positive('Valor deve ser > 0').optional(),
  metodo: z.enum(['pix', 'boleto', 'cheque', 'dinheiro', 'transferencia', 'combustivel'], {
    error: 'Selecione o método',
  }),
  quantidadeCombustivel: z.number().nonnegative('Quantidade deve ser ≥ 0').optional(),
  responsavel: z.string().min(1, 'Responsável obrigatório'),
  notaFiscal: z.string().optional().or(z.literal('')),
  pagoPor: z.string().min(1, 'Selecione quem pagou'),
  observacoes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
}).refine(
  (data) => data.metodo !== 'combustivel' || (data.quantidadeCombustivel ?? 0) > 0,
  { message: 'Quantidade obrigatória para pagamento em combustível', path: ['quantidadeCombustivel'] },
);

export type PagamentoFreteFormValues = z.infer<typeof pagamentoFreteFormSchema>;
