import { z } from 'zod';

/**
 * Schema do form de frete (Onda 4.A — RHF+Zod migration).
 *
 * Decisões:
 *  - Numéricos usam z.number obrigatório (RHF dá número via { valueAsNumber: true }
 *    no register, evitando o split input/output do z.coerce que confunde o tipo).
 *  - Campos opcionais usam .optional() + .or(z.literal('')) onde o input pode
 *    ficar vazio na UI mas semanticamente é "sem valor".
 *  - placaCarreta tem regex permissivo (Mercosul OU formato antigo). Vazia OK.
 *  - Validação cross-field (peso × km × tkm > 0) é checada no submit handler,
 *    fora do schema (regra de negócio, não regra de formato).
 *
 * Não inclui:
 *  - fotoChegadaUrl / fotoUrls / arquivoUrls — gerenciados em useState fora do
 *    schema, pois AnexosUploader atualiza array de URLs assincronamente após
 *    upload do Storage. Submit handler injeta esses no payload final.
 */
export const freteFormSchema = z.object({
  data: z.string().min(1, 'Data de saída obrigatória'),
  dataChegada: z.string().optional().or(z.literal('')),
  obraId: z.string().min(1, 'Selecione a obra'),
  origem: z.string().min(2, 'Origem obrigatória'),
  destino: z.string().min(2, 'Destino obrigatório'),
  transportadora: z.string().min(1, 'Selecione a transportadora'),
  motorista: z.string().min(2, 'Nome do motorista'),
  insumoId: z.string().min(1, 'Selecione o material'),

  pesoToneladas: z.number({ error: 'Peso obrigatório' }).positive('Peso deve ser > 0'),
  kmRodados: z.number({ error: 'KM obrigatório' }).positive('KM deve ser > 0'),
  valorTkm: z.number({ error: 'R$/TKM obrigatório' }).positive('R$/TKM deve ser > 0'),
  valorUnitarioMaterial: z.number().nonnegative('Valor unitário deve ser ≥ 0').optional(),

  notaFiscal: z.string().optional().or(z.literal('')),
  notaFiscal2: z.string().optional().or(z.literal('')),
  // Aceita ABC-1D34 (Mercosul) ou ABC-1234 (antigo). Sem hífen também ok.
  placaCarreta: z.string().regex(/^$|^[A-Z]{3}-?\d[A-Z\d]\d{2}$/i, 'Placa inválida (ex: ABC-1D34)').optional().or(z.literal('')),
  observacoes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});

export type FreteFormValues = z.infer<typeof freteFormSchema>;
