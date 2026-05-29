import { z } from 'zod'

// Zod v4.4.3 — usar API v4.
// .positive() usado em vez de .min(0).superRefine pra litros.
// superRefine para validações condicionais entre campos.

const baseSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  origem: z.enum(['tanque', 'dinheiro', 'requisicao']),
  tipoConsumidor: z.enum(['equipamento_proprio', 'carreta_transportadora']),
  tanqueId: z.string(),
  equipamentoId: z.string(),
  transportadoraId: z.string(),
  placa: z.string(),
  obraId: z.string().min(1, 'Selecione obra'),
  etapaId: z.string(),
  tipoCombustivel: z.string().min(1, 'Selecione combustível'),
  litros: z.number().positive('Litros deve ser > 0'),
  taxaLitro: z.number().min(0, 'Taxa deve ser ≥ 0'),
  precoUnitarioManual: z.number().min(0),
  precoCombustivel: z.number().min(0),
  precoCombustivelAreacre: z.number().min(0),
  motorista: z.string(),
  medicaoLeitura: z.string(),
  observacoes: z.string(),
  pago: z.boolean(),
  pagoEm: z.string(),
})

export const saidaCombustivelSchema = baseSchema.superRefine((data, ctx) => {
  // Equipamento obrigatório e REAL (bloqueia o sentinela 'desconhecido') para
  // saída de equipamento próprio. Garante rastreio de custo por máquina.
  if (
    data.tipoConsumidor === 'equipamento_proprio' &&
    (!data.equipamentoId || data.equipamentoId === 'desconhecido')
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecione um equipamento',
      path: ['equipamentoId'],
    })
  }
  // Etapa obrigatória em toda saída (aloca o custo na etapa da obra).
  if (!data.etapaId) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecione a etapa',
      path: ['etapaId'],
    })
  }
  if (data.tipoConsumidor === 'carreta_transportadora' && !data.transportadoraId) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecione transportadora',
      path: ['transportadoraId'],
    })
  }
  if (data.origem === 'tanque' && !data.tanqueId) {
    ctx.addIssue({
      code: 'custom',
      message: 'Selecione tanque',
      path: ['tanqueId'],
    })
  }
  if (data.origem !== 'tanque' && data.precoUnitarioManual <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Preço unitário deve ser > 0',
      path: ['precoUnitarioManual'],
    })
  }
  if (
    data.tipoConsumidor === 'carreta_transportadora' &&
    data.origem === 'tanque' &&
    data.precoCombustivel <= 0
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'Preço cobrado da transportadora deve ser > 0',
      path: ['precoCombustivel'],
    })
  }
})

export type SaidaCombustivelFormValues = z.infer<typeof saidaCombustivelSchema>
