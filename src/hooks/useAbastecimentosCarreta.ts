// COMPAT SHIM — Fase 3.
//
// Hook legado que ANTES lia/escrevia em `abastecimentos_carreta`. AGORA
// lê e escreve em `saidas_combustivel` filtrado por
// tipo_consumidor='carreta_transportadora' e converte os shapes pra que
// componentes legados (AbastecimentoCarretaForm, AbastecimentoCarretaList,
// abas Frete.tsx) continuem funcionando sem mudança até a Fase 4.
//
// Mapping de campos derivados:
//   AbastecimentoCarreta.transportadora (text)  ←  fornecedores.nome via JOIN
//   AbastecimentoCarreta.categoria              ←  depositos.eh_externo
//                                                  (true → 'transterra',
//                                                   false → 'emt')
//   AbastecimentoCarreta.mesReferencia          ←  data.slice(0,7) (YYYY-MM)
//   AbastecimentoCarreta.valorUnidade           ←  preco_unitario
//
// Após Fase 5: remover este arquivo + tipos AbastecimentoCarreta/
// CategoriaAbastecimentoCarreta + atualizar consumers.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  AbastecimentoCarreta,
  CategoriaAbastecimentoCarreta,
} from '../types';

const INVALIDATE_KEYS: readonly (readonly string[])[] = [
  ['saidas_combustivel'],
  ['transportadora_movimentos'],
  ['transportadora_saldos'],
  ['abastecimentos'],
  ['abastecimentos_carreta'],
];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const k of INVALIDATE_KEYS) qc.invalidateQueries({ queryKey: k });
}

/** Converte uma row de saidas_combustivel pro shape legado AbastecimentoCarreta.
 *  Espera embedded join em `fornecedores` (nome) e `depositos` (eh_externo). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCarretaLegado(row: any): AbastecimentoCarreta {
  // categoria derivada de eh_externo do tanque (Q4):
  // tanque externo (Transterra/Areacre) → 'transterra'
  // tanque interno (EMT) → 'emt'
  const ehExterno = row.depositos?.eh_externo === true;
  const categoria: CategoriaAbastecimentoCarreta = ehExterno ? 'transterra' : 'emt';

  // mesReferencia derivado de data (Q2): YYYY-MM
  const mesRef = typeof row.data === 'string' ? row.data.slice(0, 7) : '';

  return {
    id: row.id,
    data: typeof row.data === 'string' ? row.data.slice(0, 10) : row.data,
    transportadora: row.fornecedores?.nome ?? '',
    placaCarreta: row.placa ?? '',
    mesReferencia: mesRef,
    tipoCombustivel: row.tipo_combustivel ?? '',
    quantidadeLitros: Number(row.litros),
    valorUnidade: Number(row.preco_unitario),
    valorTotal: Number(row.valor_total),
    observacoes: row.observacoes ?? '',
    categoria,
    taxaLitro: Number(row.taxa_litro ?? 0),
    criadoPor: row.created_by ?? '',
  };
}

/** Converte AbastecimentoCarreta legado → payload de saidas_combustivel.
 *  Tanque é resolvido a partir da categoria:
 *    'transterra' → DEPOSITO_VIRTUAL_TRANSTERRA_ID ('mori6yyt9owm9')
 *    'emt'        → exige um tanque interno escolhido pelo usuário, mas
 *                   o shape legado AbastecimentoCarreta NÃO tem tanqueId.
 *                   Hoje o caminho EMT já resolve o tanque no form
 *                   (AbastecimentoCarretaForm passa pra outro fluxo via
 *                   onSubmitEmt) — esse INSERT direto via shim só cobre
 *                   Transterra. Caso EMT chegar aqui, RAISE pra evitar
 *                   inconsistência silenciosa.
 *
 *  transportadora_id é resolvido por lookup do nome. Backfill da Fase 1a
 *  + trigger autopopulate garantem que rows novas vão ter o id correto.
 *  Aqui, fazemos lookup explícito pra evitar depender da trigger. */
async function carretaLegadoToSaidaPayload(c: AbastecimentoCarreta) {
  if (c.categoria === 'emt') {
    throw new Error(
      'Compat shim useAbastecimentosCarreta: categoria=emt deve ir pelo fluxo onSubmitEmt do AbastecimentoCarretaForm (cria saidas_combustivel direto via useAdicionarSaidaCombustivel + escolhe tanque interno). Insert direto via este shim não suportado.'
    );
  }

  // Lookup transportadora_id por nome
  let transportadoraId: string | null = null;
  if (c.transportadora) {
    const { data: forn } = await supabase
      .from('fornecedores')
      .select('id')
      .eq('eh_transportadora', true)
      .ilike('nome', c.transportadora)
      .maybeSingle();
    transportadoraId = forn?.id ?? null;
  }

  return {
    id: c.id,
    data: `${c.data}T00:00:00`,
    origem: 'tanque' as const,
    tipo_consumidor: 'carreta_transportadora' as const,
    tanque_id: 'mori6yyt9owm9', // DEPOSITO_VIRTUAL_TRANSTERRA_ID (tech-debt seeds)
    equipamento_id: null,
    transportadora_id: transportadoraId,
    placa: c.placaCarreta || null,
    motorista_id: null,
    obra_id: null,
    etapa_id: null,
    alocacoes: null,
    tipo_combustivel: c.tipoCombustivel,
    litros: c.quantidadeLitros,
    preco_medio_tanque_snapshot: c.valorUnidade - (c.taxaLitro ?? 0),
    taxa_litro: c.taxaLitro ?? 0,
    preco_unitario: c.valorUnidade,
    valor_total: c.valorTotal,
    foto_urls: null,
    observacoes: c.observacoes || null,
    pago: null,
    pago_em: null,
    movimento_id: null,
    created_by: c.criadoPor || null,
  };
}

export function useAbastecimentosCarreta() {
  return useQuery({
    queryKey: ['abastecimentos_carreta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_combustivel')
        .select(
          'id,data,placa,tipo_combustivel,litros,preco_unitario,valor_total,observacoes,taxa_litro,created_by,' +
            'fornecedores!saidas_combustivel_transportadora_id_fkey(nome),' +
            'depositos!saidas_combustivel_tanque_id_fkey(eh_externo)'
        )
        .eq('tipo_consumidor', 'carreta_transportadora')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToCarretaLegado);
    },
  });
}

export function useAdicionarAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (carreta: AbastecimentoCarreta) => {
      const payload = await carretaLegadoToSaidaPayload(carreta);
      const { error } = await supabase.from('saidas_combustivel').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAtualizarAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (carreta: AbastecimentoCarreta) => {
      const payload = await carretaLegadoToSaidaPayload(carreta);
      const { error } = await supabase
        .from('saidas_combustivel')
        .update(payload)
        .eq('id', carreta.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExcluirAbastecimentoCarreta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saidas_combustivel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
