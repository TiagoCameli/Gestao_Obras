import { z } from 'zod'

const baseSchema = z.object({
  dataHora: z.string().min(1, 'Data e hora obrigatórias'),
  depositoOrigemId: z.string().min(1, 'Selecione tanque origem'),
  depositoDestinoId: z.string().min(1, 'Selecione tanque destino'),
  quantidadeLitros: z.number().positive('Quantidade deve ser > 0'),
  valorTotal: z.number().min(0, 'Valor deve ser ≥ 0'),
  observacoes: z.string(),
})

export const transferenciaCombustivelSchema = baseSchema.superRefine((data, ctx) => {
  if (data.depositoOrigemId && data.depositoDestinoId && data.depositoOrigemId === data.depositoDestinoId) {
    ctx.addIssue({
      code: 'custom',
      message: 'Tanque destino deve ser diferente do origem',
      path: ['depositoDestinoId'],
    })
  }
})

export type TransferenciaCombustivelFormValues = z.infer<typeof transferenciaCombustivelSchema>
