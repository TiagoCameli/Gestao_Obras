import type { Frete, PedidoMaterial, Fornecedor } from '../../../types';
import { apenasFretesDePedreira, ehTransferencia } from '../../../utils/freteTipo';

export type Severidade = 'info' | 'warning' | 'critical';
export type FreteDetectorId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';

export interface AnomaliaFrete {
  id: string;
  severity: Severidade;
  detector: FreteDetectorId;
  title: string;
  description: string;
  affectedFreteIds: string[];
  affectedFornecedorId?: string;
  affectedInsumoId?: string;
  data: string;
  acaoSugerida?: string;
}

export interface DetectFreteInput {
  fretesNoPeriodo: Frete[];   // F1, F2, F4, F5, F6
  fretesTodos: Frete[];       // F3 (saldo cumulativo, ignora filtro de período)
  pedidos: PedidoMaterial[];  // todos (referência de preço e quantidade)
  fornecedores: Fornecedor[];
  insumoNome: Map<string, string>;
  fornecedorNome: Map<string, string>;
  hoje: string;               // 'YYYY-MM-DD'
}

const PRECO_TOL = 0.10; // R$/t — tolerância de match de preço (F1)
const F6_DIAS = 7;      // dias sem chegada (F6)
const SEVERITY_ORDER: Record<Severidade, number> = { critical: 0, warning: 1, info: 2 };

export const SEVERITY_LABEL: Record<Severidade, string> = {
  critical: 'Crítica', warning: 'Atenção', info: 'Informação',
};
export const FRETE_DETECTOR_LABEL: Record<FreteDetectorId, string> = {
  F1: 'Preço de material fora do padrão',
  F2: 'Frete de material sem pedido',
  F3: 'Saldo negativo na pedreira',
  F4: 'Frete duplicado',
  F5: 'Cadastro incompleto',
  F6: 'Frete sem chegada',
};

// match flexível origem -> fornecedorId (igual FreteDashboard.findFornecedorByOrigem, linhas 663-671)
export function makeFindFornecedor(fornecedores: Fornecedor[]) {
  const list = fornecedores.map((f) => ({ id: f.id, nomeLower: f.nome.toLowerCase().trim() }));
  return (origem: string | undefined | null): string | undefined => {
    const o = (origem ?? '').toLowerCase().trim();
    if (!o) return undefined;
    const exact = list.find((f) => f.nomeLower === o);
    if (exact) return exact.id;
    const partial = list.find((f) => f.nomeLower.includes(o) || o.includes(f.nomeLower));
    return partial?.id;
  };
}

// `${fornecedorId}|${insumoId}` -> { precos: number[] distintos, qtd: soma }
export function buildPedidoInfo(pedidos: PedidoMaterial[]) {
  const map = new Map<string, { precos: number[]; qtd: number }>();
  for (const p of pedidos) {
    if (!p.fornecedorId || p.deletedAt) continue;
    for (const it of p.itens ?? []) {
      const key = `${p.fornecedorId}\x00${it.insumoId}`;
      const cur = map.get(key) ?? { precos: [], qtd: 0 };
      if (!cur.precos.some((pr) => Math.abs(pr - it.valorUnitario) < 0.005)) cur.precos.push(it.valorUnitario);
      cur.qtd += it.quantidade;
      map.set(key, cur);
    }
  }
  return map;
}

export function diasEntre(aIso: string, bIso: string): number {
  const a = new Date(`${aIso}T00:00:00`).getTime();
  const b = new Date(`${bIso}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

type Ctx = {
  input: DetectFreteInput;
  findForn: (o?: string | null) => string | undefined;
  pedidoInfo: Map<string, { precos: number[]; qtd: number }>;
  /**
   * Recortes sem frete de transferência, para os detectores que raciocinam em
   * cima de pedido de material (F1, F2, F3). Transferência move material que a
   * EMT já tem: não tem pedido, não tem preço de pedreira e não desconta saldo.
   * Sem este recorte, TODA transferência viraria um F2 "frete sem pedido" e
   * puxaria o saldo da pedreira mais parecida com a origem para o negativo.
   */
  pedreiraNoPeriodo: Frete[];
  pedreiraTodos: Frete[];
};

function detectF1(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of ctx.pedreiraNoPeriodo) {
    if (!f.insumoId || !(f.pesoToneladas > 0) || !(f.valorMaterial > 0)) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue; // origem sem fornecedor -> F5
    const info = pedidoInfo.get(`${fornId}\x00${f.insumoId}`);
    if (!info || info.precos.length === 0) continue; // sem pedido -> F2
    const unit = f.valorMaterial / f.pesoToneladas;
    if (info.precos.some((pr) => Math.abs(pr - unit) <= PRECO_TOL)) continue;
    const matNome = input.insumoNome.get(f.insumoId) ?? f.insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? (f.origem || fornId);
    out.push({
      id: `F1-${f.id}`,
      severity: 'warning',
      detector: 'F1',
      title: `Preço de ${matNome} fora do padrão (${fornNome})`,
      description: `Nota ${f.notaFiscal || 's/ NF'}: R$ ${unit.toFixed(2)}/t. Pedidos de ${matNome} nessa pedreira: ${info.precos.map((p) => `R$ ${p.toFixed(2)}`).join(', ')}.`,
      affectedFreteIds: [f.id],
      affectedFornecedorId: fornId,
      affectedInsumoId: f.insumoId,
      data: f.data,
      acaoSugerida: 'Conferir o valor de material na nota fiscal; se estiver errado, editar o frete.',
    });
  }
  return out;
}

function detectF2(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of ctx.pedreiraNoPeriodo) {
    if (!f.insumoId) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue; // origem sem fornecedor -> F5
    const info = pedidoInfo.get(`${fornId}\x00${f.insumoId}`);
    if (info && info.precos.length > 0) continue; // tem pedido -> ok (ou F1)
    const matNome = input.insumoNome.get(f.insumoId) ?? f.insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? (f.origem || fornId);
    out.push({
      id: `F2-${f.id}`,
      severity: 'warning',
      detector: 'F2',
      title: `${matNome} transportado sem pedido (${fornNome})`,
      description: `Nota ${f.notaFiscal || 's/ NF'}: não há pedido de ${matNome} cadastrado para ${fornNome}.`,
      affectedFreteIds: [f.id],
      affectedFornecedorId: fornId,
      affectedInsumoId: f.insumoId,
      data: f.data,
      acaoSugerida: 'Cadastrar o pedido de material correspondente, ou conferir a origem do frete.',
    });
  }
  return out;
}

function detectF3(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn, pedidoInfo } = ctx;
  // soma transportada por fornecedorId|insumoId (todos os fretes, saldo cumulativo)
  const transp = new Map<string, number>();
  for (const f of ctx.pedreiraTodos) {
    if (!f.insumoId || !(f.pesoToneladas > 0)) continue;
    const fornId = findForn(f.origem);
    if (!fornId) continue;
    const key = `${fornId}\x00${f.insumoId}`;
    transp.set(key, (transp.get(key) ?? 0) + f.pesoToneladas);
  }
  const out: AnomaliaFrete[] = [];
  for (const [key, qtdTransp] of transp) {
    const info = pedidoInfo.get(key);
    const qtdPed = info?.qtd ?? 0;
    const saldo = qtdPed - qtdTransp;
    if (saldo >= -0.1) continue; // só negativo relevante
    const sep = key.indexOf('\x00');
    const fornId = key.slice(0, sep);
    const insumoId = key.slice(sep + 1);
    const matNome = input.insumoNome.get(insumoId) ?? insumoId;
    const fornNome = input.fornecedorNome.get(fornId) ?? fornId;
    out.push({
      id: `F3-${key}`,
      severity: 'warning',
      detector: 'F3',
      title: `Saldo negativo de ${matNome} (${fornNome})`,
      description: `Transportado ${qtdTransp.toLocaleString('pt-BR')} t, mas só ${qtdPed.toLocaleString('pt-BR')} t foram pedidas. Saldo ${saldo.toLocaleString('pt-BR')} t.`,
      affectedFreteIds: [],
      affectedFornecedorId: fornId,
      affectedInsumoId: insumoId,
      data: input.hoje,
      acaoSugerida: 'Cadastrar pedido complementar do material, ou conferir fretes lançados a mais.',
    });
  }
  return out;
}

function detectF4(ctx: Ctx): AnomaliaFrete[] {
  const { input } = ctx;
  const out: AnomaliaFrete[] = [];
  const usados = new Set<string>(); // freteIds já reportados, evita dupla contagem

  // (a) mesma nota fiscal em 2+ fretes
  const porNota = new Map<string, Frete[]>();
  for (const f of input.fretesNoPeriodo) {
    const nf = (f.notaFiscal ?? '').trim();
    if (!nf) continue;
    (porNota.get(nf) ?? porNota.set(nf, []).get(nf)!).push(f);
  }
  for (const [nf, grupo] of porNota) {
    if (grupo.length < 2) continue;
    grupo.forEach((g) => usados.add(g.id));
    out.push({
      id: `F4-nf-${nf}`,
      severity: 'critical',
      detector: 'F4',
      title: `Nota fiscal ${nf} repetida em ${grupo.length} fretes`,
      description: `A mesma nota fiscal aparece em ${grupo.length} lançamentos de frete. Possível duplicidade.`,
      affectedFreteIds: grupo.map((g) => g.id),
      data: grupo.map((g) => g.data).sort().at(-1) ?? input.hoje,
      acaoSugerida: 'Conferir e excluir o lançamento duplicado.',
    });
  }

  // (b) mesma placa+peso+material+data
  const porCarga = new Map<string, Frete[]>();
  for (const f of input.fretesNoPeriodo) {
    if (usados.has(f.id)) continue;
    const placa = (f.placaCarreta ?? '').trim();
    if (!placa || !(f.pesoToneladas > 0)) continue;
    const key = `${placa}|${f.pesoToneladas}|${f.insumoId}|${f.data}`;
    (porCarga.get(key) ?? porCarga.set(key, []).get(key)!).push(f);
  }
  for (const [key, grupo] of porCarga) {
    if (grupo.length < 2) continue;
    out.push({
      id: `F4-carga-${key}`,
      severity: 'critical',
      detector: 'F4',
      title: `Carga repetida: ${grupo[0].placaCarreta} em ${grupo[0].data}`,
      description: `${grupo.length} fretes com mesma placa, peso (${grupo[0].pesoToneladas} t), material e data. Possível duplicidade.`,
      affectedFreteIds: grupo.map((g) => g.id),
      data: grupo[0].data,
      acaoSugerida: 'Conferir e excluir o lançamento duplicado.',
    });
  }
  return out;
}

function detectF5(ctx: Ctx): AnomaliaFrete[] {
  const { input, findForn } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    const motivos: string[] = [];
    let grave = false;
    const transf = ehTransferencia(f);
    if (!(f.pesoToneladas > 0)) { motivos.push('sem peso'); grave = true; }
    // Valor de material, NF e origem-fornecedor só fazem sentido no frete de
    // pedreira. A transferência não compra material, não emite NF e sai de um
    // ponto qualquer — cobrar isso dela alertaria em 100% dos casos.
    if (!transf && !(f.valorMaterial > 0)) { motivos.push('sem valor de material'); grave = true; }
    if (!transf && !(f.notaFiscal ?? '').trim()) motivos.push('sem nota fiscal');
    if (!(f.placaCarreta ?? '').trim()) motivos.push('sem placa');
    if (!transf && !findForn(f.origem)) motivos.push('origem não casa com nenhum fornecedor');
    if (transf && !(f.destino ?? '').trim()) { motivos.push('sem destino'); grave = true; }
    if (motivos.length === 0) continue;
    out.push({
      id: `F5-${f.id}`,
      severity: grave ? 'warning' : 'info',
      detector: 'F5',
      title: `${transf ? 'Transferência' : 'Frete'} com cadastro incompleto${f.notaFiscal ? ` (NF ${f.notaFiscal})` : ''}`,
      description: `Problemas: ${motivos.join(', ')}.`,
      affectedFreteIds: [f.id],
      affectedInsumoId: f.insumoId || undefined,
      data: f.data,
      acaoSugerida: 'Completar o cadastro do frete.',
    });
  }
  return out;
}

function detectF6(ctx: Ctx): AnomaliaFrete[] {
  const { input } = ctx;
  const out: AnomaliaFrete[] = [];
  for (const f of input.fretesNoPeriodo) {
    // Transferência não pergunta data de chegada no formulário; sem esta linha
    // toda transferência com mais de 7 dias viraria alerta permanente.
    if (ehTransferencia(f)) continue;
    if ((f.dataChegada ?? '').trim()) continue;
    if (!f.data) continue;
    if (diasEntre(f.data, input.hoje) <= F6_DIAS) continue;
    out.push({
      id: `F6-${f.id}`,
      severity: 'info',
      detector: 'F6',
      title: `Frete sem chegada há mais de ${F6_DIAS} dias${f.notaFiscal ? ` (NF ${f.notaFiscal})` : ''}`,
      description: `Saída em ${f.data}, sem data de chegada registrada.`,
      affectedFreteIds: [f.id],
      data: f.data,
      acaoSugerida: 'Registrar a data de chegada da carga.',
    });
  }
  return out;
}

export function detectAnomaliasFrete(input: DetectFreteInput): AnomaliaFrete[] {
  const ctx: Ctx = {
    input,
    findForn: makeFindFornecedor(input.fornecedores),
    pedidoInfo: buildPedidoInfo(input.pedidos),
    pedreiraNoPeriodo: apenasFretesDePedreira(input.fretesNoPeriodo),
    pedreiraTodos: apenasFretesDePedreira(input.fretesTodos),
  };
  const all: AnomaliaFrete[] = [
    ...detectF1(ctx),
    ...detectF2(ctx),
    ...detectF3(ctx),
    ...detectF4(ctx),
    ...detectF5(ctx),
    ...detectF6(ctx),
  ];
  all.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return b.data.localeCompare(a.data);
  });
  return all;
}
