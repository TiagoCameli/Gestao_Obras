/**
 * Validações de negócio para Ordens de Compra do módulo Compras v2.
 *
 * Regras de destino × tipo de item:
 *
 * | Destino                    | Material | Serviço | Campos extras                       |
 * | -------------------------- | -------- | ------- | ----------------------------------- |
 * | obra_etapa                 | ✅       | ✅      | obraId + etapaObraId obrigatórios   |
 * | obra_deposito              | ✅       | ❌      | obraId + depositoDestinoId          |
 * | deposito_central           | ✅       | ❌      | depositoDestinoId                   |
 * | sede                       | ✅       | ✅      | —                                   |
 * | manutencao_equipamento     | ✅*      | ✅      | equipamentoId; material passa pelo  |
 * |                            |          |         | almoxarifado (depositoDestinoId)    |
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
  if (!oc.tipoDestino) {
    return { ok: false, erro: 'Selecione o destino da OC.', campo: 'tipoDestino' };
  }

  const regra = REGRAS_DESTINO[oc.tipoDestino];

  if (regra.exigeObra && !oc.obraId) {
    return { ok: false, erro: `Destino "${regra.label}" exige selecionar a obra.`, campo: 'obraId' };
  }
  if (regra.exigeEtapa && !oc.etapaObraId) {
    return { ok: false, erro: `Destino "${regra.label}" exige selecionar a etapa.`, campo: 'etapaObraId' };
  }
  if (regra.exigeDeposito && !oc.depositoDestinoId) {
    return {
      ok: false,
      erro: `Destino "${regra.label}" exige selecionar o depósito de entrada.`,
      campo: 'depositoDestinoId',
    };
  }
  if (regra.exigeEquipamento && !oc.equipamentoId) {
    return {
      ok: false,
      erro: `Destino "${regra.label}" exige indicar o equipamento.`,
      campo: 'equipamentoId',
    };
  }

  // Cada item precisa ser compatível com o destino
  for (const item of oc.itens) {
    const r = validarItemNoDestino(item, oc.tipoDestino);
    if (!r.ok) {
      return {
        ok: false,
        erro: `Item "${item.descricao || 'sem descrição'}" inválido: ${r.erro}`,
      };
    }
  }

  // Regra global: TODO item do tipo material precisa de vínculo com o
  // cadastro de Insumos (consistência de descrições + saldo de estoque
  // coerente quando a OC vira entrada). A regra de manutenção é mais
  // estrita (precisa ser usadoEmManutencao=true) e é checada no bloco
  // abaixo. Aqui só garantimos que existe `insumoId` e que o tipo do
  // insumo bate com o destino (combustível só em tanque, etc.).
  for (const item of oc.itens) {
    const tipo = item.tipo ?? 'material';
    if (tipo === 'material' && !item.insumoId) {
      return {
        ok: false,
        erro: `Material "${item.descricao || 'sem descrição'}" precisa estar cadastrado (use "+ Cadastrar material" se ainda não existe).`,
      };
    }

    if (tipo === 'material' && item.insumoId && insumos) {
      const insumo = insumos.find((i) => i.id === item.insumoId);
      if (insumo && !insumoCabeNoDestino(insumo.tipo, oc.tipoDestino)) {
        const regraTipo = tipoInsumoEsperadoNoDestino(oc.tipoDestino);
        const explicacao = regraTipo.permitidos
          ? `Destino "${regra.label}" só aceita insumos do tipo: ${regraTipo.permitidos.join(', ')}. O insumo "${insumo.nome || item.descricao}" é do tipo "${insumo.tipo || 'não definido'}".`
          : `Destino "${regra.label}" não aceita insumos do tipo "${insumo.tipo || 'não definido'}". Combustível só pode ir para tanque de combustível.`;
        return { ok: false, erro: explicacao };
      }
    }
  }

  // Regras adicionais para destino "manutenção de equipamento"
  if (oc.tipoDestino === 'manutencao_equipamento') {
    const temPecas = oc.itens.some((it) => (it.tipo ?? 'material') === 'material');
    if (temPecas && !oc.depositoDestinoId) {
      return {
        ok: false,
        erro: 'Como há ao menos uma peça, selecione o almoxarifado de destino.',
        campo: 'depositoDestinoId',
      };
    }
    for (const item of oc.itens) {
      const tipo = item.tipo ?? 'material';
      if (tipo === 'material' && !item.insumoId) {
        return {
          ok: false,
          erro: `Peça "${item.descricao || 'sem descrição'}" precisa estar vinculada a um cadastro do almoxarifado.`,
        };
      }
      // Checagem extra: a peça precisa estar marcada como
      // usadoEmManutencao=true (catalogada no almoxarifado de peças).
      if (tipo === 'material' && item.insumoId && insumos) {
        const insumo = insumos.find((i) => i.id === item.insumoId);
        if (insumo && !insumo.usadoEmManutencao) {
          return {
            ok: false,
            erro: `"${insumo.nome || item.descricao}" não está cadastrado como peça de manutenção. Use "+ Cadastrar peça" ou marque o insumo como "usado em manutenção".`,
          };
        }
      }
      if (tipo === 'servico' && !item.osId) {
        return {
          ok: false,
          erro: `Mão de obra "${item.descricao || 'sem descrição'}" precisa estar vinculada a uma Ordem de Serviço (OS).`,
        };
      }
    }
  }

  // ── Tanque de combustível: amarrar com combustivelAtualId ──────────
  // Se o tanque destino já está em uso (tem um combustível corrente),
  // a OC só pode trazer ESSE MESMO combustível. Evita misturar tipos
  // diferentes no tanque (diesel num tanque que tem gasolina, etc.).
  // O DB também tem trigger pra bloquear isso na entrada, mas validar
  // no front evita o usuário só descobrir o erro depois.
  if (oc.tipoDestino === 'tanque_combustivel' && oc.depositoDestinoId && tanques) {
    const tanque = tanques.find((t) => t.id === oc.depositoDestinoId);
    const combustivelAtual = tanque?.combustivelAtualId;
    if (combustivelAtual && insumos) {
      const insumoAtual = insumos.find((i) => i.id === combustivelAtual);
      const nomeTanque = tanque?.apelido || tanque?.nome || 'tanque destino';
      const nomeCombAtual = insumoAtual?.nome || 'combustível atual';
      for (const item of oc.itens) {
        if ((item.tipo ?? 'material') !== 'material') continue;
        if (!item.insumoId) continue; // já bloqueado acima
        if (item.insumoId !== combustivelAtual) {
          const insumoItem = insumos.find((i) => i.id === item.insumoId);
          return {
            ok: false,
            erro: `Tanque "${nomeTanque}" está com ${nomeCombAtual}. Não dá pra misturar com ${insumoItem?.nome || item.descricao}. Esvazie o tanque antes ou escolha outro tanque.`,
          };
        }
      }
    }
  }

  return { ok: true };
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
