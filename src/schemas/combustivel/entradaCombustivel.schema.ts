import { z } from 'zod'

export const entradaCombustivelSchema = z.object({
  dataHora: z.string().min(1, 'Data e hora obrigatórias'),
  depositoId: z.string().min(1, 'Selecione um tanque'),
  tipoCombustivel: z.string().min(1, 'Selecione o combustível'),
  quantidadeLitros: z.number({ invalid_type_error: 'Quantidade obrigatória' }).positive('Quantidade deve ser > 0'),
  valorUnitario: z.number({ invalid_type_error: 'Valor unitário obrigatório' }).positive('Valor unitário deve ser > 0'),
  fornecedor: z.string().min(1, 'Selecione o fornecedor'),
  notaFiscal: z.string(),
  observacoes: z.string(),
})

export type EntradaCombustivelFormValues = z.infer<typeof entradaCombustivelSchema>
