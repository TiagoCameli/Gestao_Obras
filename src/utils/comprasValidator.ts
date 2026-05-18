/**
 * Validações de negócio para Ordens de Compra do módulo Compras v2.
 *
 * ⚠ MUDANÇA IMPORTANTE (v2.7): destino genérico na compra + específico no
 * recebimento. Na cotação/OC, o usuário escolhe APENAS o TIPO de destino
 * (obra+etapa, almoxarifado, tanque, etc.). O depósito/tanque/almoxarifado
 * ESPECÍFICO só vira obrigatório no momento do RECEBIMENTO da OC.
 *
 * Regras de destino × tipo de item (na hora de salvar OC):
 *
 * | Destino                    | Material | Serviço | Obrigatório na OC                  |
 * | -------------------------- | -------- | ------- | ----------------------------------- |
 * | obra_etapa                 | ✅       | ✅      | obraId + etapaObraId                 |
 * | obra_deposito              | ✅       | ❌      | obraId (depósito → no recebimento)  |
 * | deposito_central           | ✅       | ❌      | — (depósito → no recebimento)        |
 * | sede                       | ✅       | ✅      | —                                   |
 * | manutencao_equipamento     | ✅*      | ✅      | osId p/ serviço (almox → no receb.) |
 * | tanque_combustivel         | ✅       | ❌      | — (tanque → no recebimento)         |
 */

import type { ItemOrdemCompra, OrdemCompra, TipoDestinoOC } from '../types';

export type ValidacaoResultado =
  | { ok: true }
  | { ok: false; erro: string; campo?: string };

export interface RegraDestino {
  aceitaMaterial: boolean;
  aceitaServico: boolean;
  exigeObra: boolean;
  exigeEtapa: boolean;
  exigeDeposito: boolean;
  exigeEquipamento: boolean;
  /** Para manutenção: material sempre passa pelo almoxarifado */
  geraEntradaDeposito: boolean;
  label: string;
}

export const REGRAS_DESTINO: Record<TipoDestinoOC, RegraDestino> = {
  obra_etapa: {
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: true,
    exigeEtapa: true,
    exigeDeposito: false,
    exigeEquipamento: false,
    geraEntradaDeposito: false,
    label: 'Obra (etapa específica)',
  },
  obra_deposito: {
    aceitaMaterial: true,
    aceitaServico: false,
    exigeObra: true,
    exigeEtapa: false,
    exigeDeposito: true,
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Obra (depósito da obra)',
  },
  deposito_central: {
    aceitaMaterial: true,
    aceitaServico: false,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: true,
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Depósito Central',
  },
  sede: {
    // Sede aceita material E mão de obra (despesas administrativas,
    // serviços terceiros pra própria empresa, etc.). Nenhum vínculo
    // extra é exigido — vai direto pro financeiro.
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: false,
    exigeEquipamento: false,
    geraEntradaDeposito: false,
    label: 'Sede da empresa',
  },
  manutencao_equipamento: {
    // Material (peça) vai pro almoxarifado. Serviço vai DIRETO pra uma OS
    // de equipamento específico (não estoca). Regras por item:
    //   - peça: insumoId obrigatório (deve ser usado_em_manutencao=true)
    //   - serviço: osId obrigatório (vincula a uma Ordem de Serviço)
    // Almoxarifado é exigido SE houver ao menos 1 item peça.
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: false, // checagem dinâmica via temPecas em validarOrdemCompra
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Manutenção de equipamento',
  },
  tanque_combustivel: {
    // Entrada de combustível: vai pro tanque e PRONTO. A distribuição
    // por obra/etapa é feita depois, via saída de combustível.
    aceitaMaterial: true, // combustível é "material" tipo "combustível"
    aceitaServico: false,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: true, // o "depósito" aqui é o tanque
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Tanque de combustível',
  },
};

export function regraDoDestino(destino: TipoDestinoOC): RegraDestino {
  return REGRAS_DESTINO[destino];
}

/**
 * Tipo de insumo esperado por destino (slug do TipoInsumo).
 *
 *   tanque_combustivel   → 'combustivel'  (e só ele)
 *   manutencao_equipamento (peça) → 'peca' OU usadoEmManutencao=true
 *                            (regra checada no validador via flag)
 *   demais destinos      → qualquer tipo EXCETO combustível (combustível
 *                            sempre vai pra tanque, nunca pra depósito comum)
 *
 * Retorna `null` quando o destino aceita qualquer tipo.
 */
export function tipoInsumoEsperadoNoDestino(destino: TipoDestinoOC): {
  permitidos?: string[];
  proibidos?: string[];
} {
  switch (destino) {
    case 'tanque_combustivel':
      return { permitidos: ['combustivel', 'combustível'] };
    case 'obra_etapa':
    case 'obra_deposito':
    case 'deposito_central':
    case 'sede':
    case 'manutencao_equipamento':
    default:
      return { proibidos: ['combustivel', 'combustível'] };
  }
}

/** Helper para checar se um insumo (já com `tipo` definido) cabe no destino. */
export function insumoCabeNoDestino(
  insumoTipo: string | undefined,
  destino: TipoDestinoOC
): boolean {
  const tipo = (insumoTipo ?? '').toLowerCase();
  const regra = tipoInsumoEsperadoNoDestino(destino);
  if (regra.permitidos) return regra.permitidos.includes(tipo);
  if (regra.proibidos) return !regra.proibidos.includes(tipo);
  return true;
}

/**
 * Valida se um item específico é compatível com o destino da OC.
 */
export function validarItemNoDestino(
  item: ItemOrdemCompra,
  destino: TipoDestinoOC
): ValidacaoResultado {
  const regra = REGRAS_DESTINO[destino];
  const tipo = item.tipo ?? 'material';

  if (tipo === 'material' && !regra.aceitaMaterial) {
    return { ok: false, erro: `Destino "${regra.label}" não aceita materiais.` };
  }
  if (tipo === 'servico' && !regra.aceitaServico) {
    return { ok: false, erro: `Destino "${regra.label}" não aceita mão de obra.` };
  }
  return { ok: true };
}

/**
 * Validação completa da OC antes de salvar.
 *
 * Os parâmetros extras são opcionais — quando fornecidos, habilitam
 * checagens cruzadas mais robustas:
 *
 *   - `insumos`: valida tipo do insumo × destino, usadoEmManutencao em
 *     manutenção, e detecta mistura de combustível diferente no tanque.
 *   - `tanques`: valida que o combustível da OC bate com o
 *     `combustivelAtualId` do tanque destino (se houver). Cada tanque
 *     guarda qual combustível está atualmente armazenado — não pode
 *     misturar diesel num tanque que tem gasolina, por exemplo.
 */
export function validarOrdemCompra(
  oc: OrdemCompra,
  insumos?: { id: string; tipo?: string; usadoEmManutencao?: boolean; nome?: string }[],
  tanques?: { id: string; nome?: string; apelido?: string | null; combustivelAtualId?: string | null }[]
): ValidacaoResultado {
  if (!oc.fornecedorId) {
    return { ok: false, erro: 'Selecione um fornecedor.', campo: 'fornecedorId' };
  }
  if (oc.itens.length === 0) {
    return { ok: false, erro: 'Adicione ao menos um item.', campo: 'itens' };
  }

  // ─────────────────────────────────────────────────────────────────
  // v2.5+: destino É POR ITEM. Cada item carrega `item.tipoDestino`,
  // `item.obraId`, `item.etapaObraId`, `item.depositoDestinoId`,
  // `item.equipamentoId`. A OC pode ter múltiplos destinos numa só.
  //
  // Fallback retrocompat: se o item não tem destino próprio (OC antiga),
  // herdamos o destino global da OC (`oc.tipoDestino` etc.).
  // ─────────────────────────────────────────────────────────────────

  // Agrupa itens por "chave de destino" pra checar campos contextuais
  // uma vez por grupo, e pra dar mensagens de erro mais úteis (índice
  // do item, descrição).
  for (let idx = 0; idx < oc.itens.length; idx++) {
    const item = oc.itens[idx];
    const destino = item.tipoDestino ?? oc.tipoDestino;
    if (!destino) {
      return {
        ok: false,
        erro: `Item ${idx + 1} ("${item.descricao || 'sem descrição'}") está sem destino. Selecione o destino do bloco.`,
      };
    }
    const regra = REGRAS_DESTINO[destino];

    // Campos contextuais por item (herdam da OC quando não definidos)
    const obraId = item.obraId || oc.obraId;
    const etapaObraId = item.etapaObraId || oc.etapaObraId;
    const depositoDestinoId = item.depositoDestinoId || oc.depositoDestinoId;
    const equipamentoId = item.equipamentoId || oc.equipamentoId;

    if (regra.exigeObra && !obraId) {
      return { ok: false, erro: `Item "${item.descricao}" exige obra (destino: ${regra.label}).` };
    }
    if (regra.exigeEtapa && !etapaObraId) {
      return { ok: false, erro: `Item "${item.descricao}" exige etapa (destino: ${regra.label}).` };
    }
    if (regra.exigeEquipamento && !equipamentoId) {
      return { ok: false, erro: `Item "${item.descricao}" exige equipamento (destino: ${regra.label}).` };
    }

    // Compatibilidade tipo-item × destino
    const r = validarItemNoDestino(item, destino);
    if (!r.ok) {
      return {
        ok: false,
        erro: `Item "${item.descricao || 'sem descrição'}" inválido: ${r.erro}`,
      };
    }

    const tipo = item.tipo ?? 'material';

    // Material precisa de vínculo com cadastro de insumos
    if (tipo === 'material' && !item.insumoId) {
      return {
        ok: false,
        erro: `Material "${item.descricao || 'sem descrição'}" precisa estar cadastrado (use "+ Cadastrar material" se ainda não existe).`,
      };
    }

    // ⚠ v2.7: depósito/almoxarifado/tanque ESPECÍFICO é OPCIONAL na OC.
    // Esse vínculo passa a ser obrigatório só no momento do RECEBIMENTO.
    // Permite ao comprador emitir a OC sem saber ainda onde o material vai
    // ficar (almox A ou B? tanque 1 ou 2?). A escolha cai pra quem recebe.
    //
    // O tipo de destino (obra_etapa, tanque_combustivel, etc.) continua
    // obrigatório — só o "subdestino" físico que ficou flexível.

    // Tipo de insumo × destino (combustível só em tanque, etc.)
    if (tipo === 'material' && item.insumoId && insumos) {
      const insumo = insumos.find((i) => i.id === item.insumoId);
      if (insumo && !insumoCabeNoDestino(insumo.tipo, destino)) {
        const regraTipo = tipoInsumoEsperadoNoDestino(destino);
        const explicacao = regraTipo.permitidos
          ? `Destino "${regra.label}" só aceita insumos do tipo: ${regraTipo.permitidos.join(', ')}. O insumo "${insumo.nome || item.descricao}" é do tipo "${insumo.tipo || 'não definido'}".`
          : `Destino "${regra.label}" não aceita insumos do tipo "${insumo.tipo || 'não definido'}". Combustível só pode ir para tanque de combustível.`;
        return { ok: false, erro: explicacao };
      }
      // Em manutenção: insumo precisa estar marcado como usadoEmManutencao
      if (destino === 'manutencao_equipamento' && insumo && !insumo.usadoEmManutencao) {
        return {
          ok: false,
          erro: `"${insumo.nome || item.descricao}" não está cadastrado como peça de manutenção. Use "+ Cadastrar peça" ou marque o insumo como "usado em manutenção".`,
        };
      }
    }

    // Serviço em manutenção precisa de OS vinculada
    if (destino === 'manutencao_equipamento' && tipo === 'servico' && !item.osId) {
      return {
        ok: false,
        erro: `Mão de obra "${item.descricao || 'sem descrição'}" precisa estar vinculada a uma Ordem de Serviço (OS).`,
      };
    }

    // Tanque com combustível corrente: só aceita esse combustível
    if (destino === 'tanque_combustivel' && depositoDestinoId && tanques && insumos) {
      const tanque = tanques.find((t) => t.id === depositoDestinoId);
      const combustivelAtual = tanque?.combustivelAtualId;
      if (combustivelAtual && item.insumoId && item.insumoId !== combustivelAtual) {
        const insumoAtual = insumos.find((i) => i.id === combustivelAtual);
        const nomeTanque = tanque?.apelido || tanque?.nome || 'tanque destino';
        const insumoItem = insumos.find((i) => i.id === item.insumoId);
        return {
          ok: false,
          erro: `Tanque "${nomeTanque}" está com ${insumoAtual?.nome || 'combustível atual'}. Não dá pra misturar com ${insumoItem?.nome || item.descricao}. Esvazie o tanque ou escolha outro tanque.`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Rateia os custos adicionais (frete, impostos, outras despesas, desconto)
 * proporcionalmente ao subtotal de cada item da OC.
 *
 * Retorna um Map<itemId, valorRateado> com a fatia somada de cada item.
 * O desconto entra como negativo (reduz o valor do item).
 *
 * Exemplo:
 *   itens: A=R$100, B=R$300 (total R$400)
 *   custos: frete=R$40
 *   → A recebe 40 × 100/400 = R$10
 *   → B recebe 40 × 300/400 = R$30
 *
 * Caso o total seja 0 (sem itens com preço), distribui igualmente.
 */
export function ratearCustosAdicionais(
  itens: { id: string; subtotal: number }[],
  custos: { frete: number; outrasDespesas: number; impostos: number; desconto: number }
): Map<string, number> {
  const totalSubtotal = itens.reduce((s, it) => s + (it.subtotal || 0), 0);
  const custoLiquido = (custos.frete || 0) + (custos.outrasDespesas || 0)
    + (custos.impostos || 0) - (custos.desconto || 0);
  const map = new Map<string, number>();
  if (itens.length === 0) return map;
  if (totalSubtotal === 0) {
    // Distribuição igualitária quando todos têm subtotal 0
    const parte = custoLiquido / itens.length;
    for (const it of itens) map.set(it.id, parte);
    return map;
  }
  for (const it of itens) {
    const fatia = ((it.subtotal || 0) / totalSubtotal) * custoLiquido;
    map.set(it.id, fatia);
  }
  return map;
}

/**
 * Calcula o "destino consolidado" da OC a partir dos destinos dos itens.
 *
 * - Se todos os itens têm o mesmo destino → retorna esse destino
 *   (compat com listas antigas que mostram só um destino).
 * - Se misturam destinos → retorna undefined (a OC é "múltipla").
 */
export function destinoConsolidadoDaOC(
  itens: { tipoDestino?: TipoDestinoOC }[]
): TipoDestinoOC | undefined {
  const destinos = new Set(itens.map((i) => i.tipoDestino).filter(Boolean));
  if (destinos.size === 1) return [...destinos][0] as TipoDestinoOC;
  return undefined;
}

/**
 * Validação do pedido — exige itens OU descrição livre (modelo híbrido).
 */
export function validarPedidoCompra(pedido: {
  itens: { descricao?: string }[];
  descricaoLivre?: string;
  obraId?: string;
  solicitante?: string;
}): ValidacaoResultado {
  if (!pedido.solicitante?.trim()) {
    return { ok: false, erro: 'Informe o solicitante.', campo: 'solicitante' };
  }
  const temItens = pedido.itens.some((i) => (i.descricao ?? '').trim().length > 0);
  const temDescricao = (pedido.descricaoLivre ?? '').trim().length > 0;
  if (!temItens && !temDescricao) {
    return {
      ok: false,
      erro: 'Adicione ao menos um item OU escreva uma descrição livre do pedido.',
      campo: 'itens',
    };
  }
  return { ok: true };
}

/**
 * Detecta itens potencialmente duplicados (busca fuzzy simples) na base de Insumos.
 * Retorna a lista ordenada por similaridade (maior primeiro).
 */
export function buscarInsumosSimilares(
  termo: string,
  insumos: { id: string; nome: string; categoria?: string }[],
  limite: number = 5
): { id: string; nome: string; categoria?: string; similaridade: number }[] {
  const t = normalizar(termo);
  if (!t) return [];
  return insumos
    .map((i) => ({ ...i, similaridade: similaridade(t, normalizar(i.nome)) }))
    .filter((i) => i.similaridade > 0.55)
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, limite);
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similaridade simples baseada em tokens compartilhados. 0..1. */
function similaridade(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const uniao = new Set([...ta, ...tb]).size;
  return uniao === 0 ? 0 : inter / uniao;
}
