/**
 * Sugestões padrão para campos de pagamento e prazo em Compras.
 * Cobre as condições e formas de pagamento mais comuns no mercado brasileiro
 * de construção civil. Usuário ainda pode digitar valores customizados.
 */

export const CONDICOES_PAGAMENTO_BR: string[] = [
  'À vista',
  'Antecipado',
  'Faturado 7 dias',
  'Faturado 10 dias',
  'Faturado 14 dias',
  'Faturado 15 dias',
  'Faturado 21 dias',
  'Faturado 28 dias',
  'Faturado 30 dias',
  'Faturado 45 dias',
  'Faturado 60 dias',
  'Faturado 90 dias',
  '15/30 dias',
  '15/30/45 dias',
  '28/56 dias',
  '28/56/84 dias',
  '30/60 dias',
  '30/60/90 dias',
  '30/60/90/120 dias',
  '7/14/21 dias',
  '14/28/42 dias',
  '30/45/60 dias',
  'Entrada + 30 dias',
  'Entrada + 30/60 dias',
  'Entrada + 30/60/90 dias',
  '50% antecipado + 50% na entrega',
  '50% antecipado + 50% em 30 dias',
  '30% antecipado + 70% na entrega',
  'Conforme medição',
  'Conforme contrato',
];

export const FORMAS_PAGAMENTO_BR: string[] = [
  'PIX',
  'Boleto bancário',
  'Transferência bancária (TED)',
  'Transferência bancária (DOC)',
  'Depósito em conta',
  'Cartão de crédito',
  'Cartão de débito',
  'Cheque',
  'Cheque pré-datado',
  'Dinheiro',
  'PIX ou Boleto',
  'Boleto ou Transferência',
  'PIX, Boleto ou Transferência',
  'Boleto / PIX / Transferência',
  'Faturado',
];
