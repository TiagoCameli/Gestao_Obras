import { z } from 'zod';

/**
 * Schema do form de pedido de material (Onda 4.C — RHF+Zod).
 *
 * Cobre apenas os campos top-level. Array `itens` (insumoId, quantidade,
 * valorUnitario) é gerenciado em useState fora do RHF (não vale a pena
 * useFieldArray pra este caso — itens são UI puramente local até submit).
 * Validação de itens fica no submit handler.
 */
export const pedidoMaterialFormSchema = z.object({
  data: z.string().min(1, 'Data do pedido obrigatória'),
  fornecedorId: z.string().min(1, 'Selecione o fornecedor'),
  observacoes: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
});

export type PedidoMaterialFormValues = z.infer<typeof pedidoMaterialFormSchema>;
