import { z } from 'zod';

/**
 * Schema do form de lançamento financeiro (Onda 5.D — RHF+Zod).
 *
 * Cobre APENAS os 9 campos top-level scalares. parcelas[], rateios[]
 * e anexosUrls[] permanecem em useState (lógica complex: redistribuição
 * automática, soma==valorTotal, tipos de destino com campos contextuais,
 * upload async pro Storage).
 *
 * Cross-validations (soma das parcelas/rateios bate com total, rateio
 * obra_etapa precisa de obraId+etapaObraId, fornecedor OU favorecido)
 * ficam na função `validar()` do componente, chamada no submit handler.
 * Schema captura só o que cabe sync per-field (required, > 0).
 */
export const lancamentoFinanceiroFormSchema = z.object({
  dataEmissao: z.string().min(1, 'Data de emissão obrigatória'),
  fornecedorId: z.string().optional().or(z.literal('')),
  favorecidoNome: z.string().optional().or(z.literal('')),
  empresaPagadoraId: z.string().optional().or(z.literal('')),
  categoriaId: z.string().optional().or(z.literal('')),
  descricao: z.string().min(1, 'Informe uma descrição'),
  valorTotal: z.number({ error: 'Valor obrigatório' }).positive('Valor deve ser > 0'),
  formaPagamento: z.enum([
    'pix', 'boleto', 'transferencia', 'deposito', 'dinheiro',
    'cartao_credito', 'cartao_debito', 'cheque', 'outros',
  ]),
  observacoes: z.string().optional().or(z.literal('')),
});

export type LancamentoFinanceiroFormValues = z.infer<typeof lancamentoFinanceiroFormSchema>;
