// Gerador do template "Por Obra" — PDF + Excel.
// Espelha mensalConsolidadoExport.ts mas escopado a uma obra específica.
//
// Charts reaproveitam o pipeline F4.A.2 (TopEquipamentos + EvolucaoTemporal)
// — basta que o caller passe os SaidaCombustivel já filtrados pela obra+mês,
// que esses 2 charts agregam corretamente.

import jsPDF from 'jspdf';
import type {
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  EntradaCombustivel,
  SaidaCombustivel,
} from '../../../../types';
import {
  BRAND,
  PDF_RGB,
  createWorkbook,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfSectionTitle,
  fmtBRL,
  fmtNum,
  formatDateBR,
  formatMesRef,
  renderExcelBanner,
  renderExcelFiltros,
  renderExcelKPIs,
  renderExcelDetalhamento,
  renderExcelSectionTitle,
  sanitizeFilenamePart,
} from '../../../../utils/exportTemplate';
import type { ChartImagens } from './mensalConsolidadoExport';

const TITULO = 'Combustível · Relatório Por Obra';
const SUBTITULO_BASE = 'Detalhamento de consumo escopado por obra';
const MARCA = 'Gestão de Obras · Combustível';

interface PorObraInput {
  obra: Obra;
  mesReferencia: string; // YYYY-MM
  /** Saídas já filtradas: tipoConsumidor (proprios+carretas), obra=X, mês ref. */
  saidasObra: SaidaCombustivel[];
  /** Entradas do mês (não têm FK a obra; mostradas como contexto de fornecedores). */
  entradasNoMes: EntradaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  charts?: ChartImagens;
}

interface Agg { litros: number; custo: number; qtd: number; }

function topByLitros<T extends { litros: number }>(
  map: Map<string, T>,
  n: number,
): Array<[string, T]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1].litros - a[1].litros)
    .slice(0, n);
}

interface PorObraData {
  totais: {
    volume: number;
    custo: number;
    rPorL: number;
    qtdSaidas: number;
    qtdEquipamentos: number;
    qtdSentinel: number;
    qtdCarretas: number;
    volumeCompras: number;
    custoCompras: number;
    qtdFornecedores: number;
  };
  topEquipamentos: Array<{ nome: string; codigo: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  topCarretas: Array<{ placa: string; transportadora: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  fornecedores: Array<{ nome: string; litros: number; custo: number; rPorL: number; qtd: number }>;
  saidasDesc: SaidaCombustivel[];
}

function compute(input: PorObraInput): PorObraData {
  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(input.transportadoras.map((t) => [t.id, t.nome]));

  let volume = 0;
  let custo = 0;
  let qtdSentinel = 0;
  const eqSet = new Set<string>();
  const carretaSet = new Set<string>();
  const aggEq = new Map<string, Agg & { codigoPatrimonio: string; tipo: string }>();
  const aggCarreta = new Map<string, Agg & { transportadora: string }>();

  for (const s of input.saidasObra) {
    volume += s.litros;
    custo += s.valorTotal;
    if (s.tipoConsumidor === 'equipamento_proprio') {
      if (s.equipamentoId === 'desconhecido') {
        qtdSentinel += 1;
      } else if (s.equipamentoId) {
        eqSet.add(s.equipamentoId);
        const eq = eqMap.get(s.equipamentoId);
        const cur = aggEq.get(s.equipamentoId) ?? {
          litros: 0,
          custo: 0,
          qtd: 0,
          codigoPatrimonio: eq?.codigoPatrimonio ?? '',
          tipo: eq?.tipo ?? '',
        };
        cur.litros += s.litros;
        cur.custo += s.valorTotal;
        cur.qtd += 1;
        aggEq.set(s.equipamentoId, cur);
      }
    } else if (s.tipoConsumidor === 'carreta_transportadora') {
      const placa = (s.placa || '').trim();
      if (placa) {
        carretaSet.add(placa);
        const transpNome = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
        const cur = aggCarreta.get(placa) ?? { litros: 0, custo: 0, qtd: 0, transportadora: transpNome };
        cur.litros += s.litros;
        cur.custo += s.valorTotal;
        cur.qtd += 1;
        aggCarreta.set(placa, cur);
      }
    }
  }

  let volumeCompras = 0;
  let custoCompras = 0;
  const fornSet = new Set<string>();
  const aggForn = new Map<string, Agg>();
  for (const e of input.entradasNoMes) {
    volumeCompras += e.quantidadeLitros;
    custoCompras += e.valorTotal;
    const nome = (e.fornecedor || '').trim();
    if (nome) {
      fornSet.add(nome);
      const cur = aggForn.get(nome) ?? { litros: 0, custo: 0, qtd: 0 };
      cur.litros += e.quantidadeLitros;
      cur.custo += e.valorTotal;
      cur.qtd += 1;
      aggForn.set(nome, cur);
    }
  }

  const saidasDesc = [...input.saidasObra].sort((a, b) => b.data.localeCompare(a.data));

  return {
    totais: {
      volume,
      custo,
      rPorL: volume > 0 ? custo / volume : 0,
      qtdSaidas: input.saidasObra.length,
      qtdEquipamentos: eqSet.size,
      qtdSentinel,
      qtdCarretas: carretaSet.size,
      volumeCompras,
      custoCompras,
      qtdFornecedores: fornSet.size,
    },
    topEquipamentos: topByLitros(aggEq, 10).map(([id, v]) => {
      const eq = eqMap.get(id);
      return {
        nome: eq?.nome ?? id,
        codigo: v.codigoPatrimonio || v.tipo || '',
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtd: v.qtd,
      };
    }),
    topCarretas: topByLitros(aggCarreta, 10).map(([placa, v]) => ({
      placa,
      transportadora: v.transportadora,
      litros: v.litros,
      custo: v.custo,
      rPorL: v.litros > 0 ? v.custo / v.litros : 0,
      qtd: v.qtd,
    })),
    fornecedores: Array.from(aggForn.entries())
      .sort((a, b) => b[1].litros - a[1].litros)
      .map(([nome, v]) => ({
        nome,
        litros: v.litros,
        custo: v.custo,
        rPorL: v.litros > 0 ? v.custo / v.litros : 0,
        qtd: v.qtd,
      })),
    saidasDesc,
  };
}

function nomeArquivo(input: PorObraInput, ext: 'pdf' | 'xlsx'): string {
  const obraSlug = sanitizeFilenamePart(input.obra.nome);
  const mesSlug = formatMesRef(input.mesReferencia).replace('/', '-');
  return `EMT - Por Obra - ${obraSlug} - ${mesSlug}.${ext}`;
}

// ════════════════════════════════════════════════════════════════════
// PDF
// ════════════════════════════════════════════════════════════════════

export function exportarPorObraPDF(input: PorObraInput): void {
  const data = compute(input);
  const t = data.totais;
  const subtitulo = `${input.obra.nome} · ${formatMesRef(input.mesReferencia)}`;
  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(input.transportadoras.map((tr) => [tr.id, tr.nome]));
  // FK soft pra insumos.id — sem isso, coluna "Combustível" mostra UUID
  // (mlvjtpi8o1vmk) em vez do nome amigável (Diesel S10).
  const combMap = new Map(input.combustiveis.map((c) => [c.id, c.nome]));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Página 1: Capa ──
  let y = drawPdfBanner(doc, TITULO, `${SUBTITULO_BASE} · ${subtitulo}`);
  y = drawPdfFiltros(doc, y + 4, [
    ['Obra', input.obra.nome],
    ['Mês referência', formatMesRef(input.mesReferencia)],
    ['Total saídas', `${t.qtdSaidas} registros`],
    ['Status da obra', input.obra.status],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Volume Total', `${fmtNum(t.volume, 0)} L`],
    ['Custo Total', fmtBRL(t.custo)],
    ['R$/L Médio', t.rPorL > 0 ? `R$ ${fmtNum(t.rPorL, 4)}` : '—'],
    ['Saídas', String(t.qtdSaidas)],
  ]);
  y = drawPdfKPIs(doc, y + 4, [
    ['Equipamentos próprios', String(t.qtdEquipamentos)],
    ['Carretas', String(t.qtdCarretas)],
    ['Fornecedores (mês)', String(t.qtdFornecedores)],
    ['Compras (Entradas)', fmtBRL(t.custoCompras)],
  ]);

  if (t.qtdSentinel > 0) {
    y = drawPdfSectionTitle(doc, y + 6, `ATENÇÃO: ${t.qtdSentinel} saída(s) sem equipamento identificado`);
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'Atribuir retroativamente via aba "Saídas" (filtro "Apenas sem equipamento") melhora a precisão deste relatório.',
      10, y,
    );
  }

  // ── Página 2: Top Equipamentos da obra (chart + tabela) ──
  if (data.topEquipamentos.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Top 10 equipamentos próprios na obra', data.topEquipamentos.length);
    let yEq = 20;
    if (input.charts?.topEquipamentos) {
      const pageWmm = doc.internal.pageSize.getWidth();
      const imgW = 240;
      const imgH = imgW * (360 / 800);
      const x = (pageWmm - imgW) / 2;
      doc.addImage(input.charts.topEquipamentos, 'PNG', x, yEq, imgW, imgH);
      yEq += imgH + 4;
    }
    drawPdfDetailTable(
      doc,
      yEq,
      ['#', 'Equipamento', 'Código', 'Saídas', 'Litros', 'Custo', 'R$/L'],
      data.topEquipamentos.map((r, i) => [
        String(i + 1),
        r.nome,
        r.codigo,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', '', String(data.topEquipamentos.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.topEquipamentos.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.topEquipamentos.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 32 },
        6: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // ── Página 3: Evolução temporal da obra (chart) ──
  if (input.charts?.evolucaoTemporal) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Evolução do consumo no mês', t.qtdSaidas);
    const pageWmm = doc.internal.pageSize.getWidth();
    const imgW = 240;
    const imgH = imgW * (280 / 800);
    const x = (pageWmm - imgW) / 2;
    doc.addImage(input.charts.evolucaoTemporal, 'PNG', x, 20, imgW, imgH);
    // Sub-resumo abaixo: top carretas (se houver) numa mini-tabela
    if (data.topCarretas.length > 0) {
      const yC = 20 + imgH + 8;
      drawPdfDetailTable(
        doc,
        yC,
        ['#', 'Placa', 'Transportadora', 'Saídas', 'Litros', 'Custo', 'R$/L'],
        data.topCarretas.map((r, i) => [
          String(i + 1),
          r.placa,
          r.transportadora,
          String(r.qtd),
          fmtNum(r.litros, 0),
          fmtBRL(r.custo),
          r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
        ]),
        ['', 'Total', '', String(data.topCarretas.reduce((s, r) => s + r.qtd, 0)),
          fmtNum(data.topCarretas.reduce((s, r) => s + r.litros, 0), 0),
          fmtBRL(data.topCarretas.reduce((s, r) => s + r.custo, 0)),
          ''],
        {
          0: { halign: 'right', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 28 },
          2: { halign: 'left', cellWidth: 70 },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 26 },
          5: { halign: 'right', cellWidth: 32 },
          6: { halign: 'right', cellWidth: 26 },
        },
        MARCA,
      );
    }
  }

  // ── Página 4: Saídas detalhadas (cronológico DESC) ──
  if (data.saidasDesc.length > 0) {
    doc.addPage();
    drawPdfDetailPageHeader(doc, 'Saídas detalhadas', data.saidasDesc.length);
    drawPdfDetailTable(
      doc,
      20,
      ['Data', 'Consumidor', 'Combustível', 'Litros', 'R$/L', 'Custo'],
      data.saidasDesc.map((s) => {
        let consumidor = '—';
        if (s.tipoConsumidor === 'equipamento_proprio') {
          if (s.equipamentoId === 'desconhecido') {
            // jsPDF helvetica default não renderiza ⚠ (vira "&"). Texto puro.
            consumidor = 'Não identificado';
          } else if (s.equipamentoId) {
            const eq = eqMap.get(s.equipamentoId);
            // Quando codigo está vazio, evita o " · " órfão antes do nome.
            const codigo = eq?.codigoPatrimonio || eq?.tipo || '';
            consumidor = eq ? (codigo ? `${codigo} · ${eq.nome}` : eq.nome) : s.equipamentoId;
          }
        } else if (s.tipoConsumidor === 'carreta_transportadora') {
          const transp = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
          consumidor = `${s.placa ?? '—'}${transp ? ` · ${transp}` : ''}`;
        }
        const rPorL = s.litros > 0 ? s.valorTotal / s.litros : 0;
        return [
          formatDateBR(s.data),
          consumidor,
          combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel,
          fmtNum(s.litros, 0),
          rPorL > 0 ? `R$ ${fmtNum(rPorL, 4)}` : '—',
          fmtBRL(s.valorTotal),
        ];
      }),
      ['', 'Total', '',
        fmtNum(data.saidasDesc.reduce((s, x) => s + x.litros, 0), 0),
        '',
        fmtBRL(data.saidasDesc.reduce((s, x) => s + x.valorTotal, 0)),
      ],
      {
        0: { halign: 'left', cellWidth: 24 },
        1: { halign: 'left', cellWidth: 80 },
        2: { halign: 'left', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 32 },
      },
      MARCA,
    );
  }

  // ── Página final: Fornecedores + slot Anomalias placeholder ──
  // Replicação fiel do padrão Mensal — Anomalias renderiza no pé da
  // mesma página dos Fornecedores (yAnom = pageH - 50). Tentativa
  // anterior com doc.addPage() dedicado não vingou (página não saiu).
  doc.addPage();
  drawPdfDetailPageHeader(doc, 'Fornecedores e Anomalias', data.fornecedores.length);

  if (data.fornecedores.length > 0) {
    let yF = 18;
    yF = drawPdfSectionTitle(doc, yF, 'FORNECEDORES (COMPRAS NO PERÍODO — TANQUES EMT)');
    drawPdfDetailTable(
      doc,
      yF,
      ['#', 'Fornecedor', 'Compras', 'Litros', 'Custo', 'R$/L médio'],
      data.fornecedores.map((r, i) => [
        String(i + 1),
        r.nome,
        String(r.qtd),
        fmtNum(r.litros, 0),
        fmtBRL(r.custo),
        r.rPorL > 0 ? `R$ ${fmtNum(r.rPorL, 4)}` : '—',
      ]),
      ['', 'Total', String(data.fornecedores.reduce((s, r) => s + r.qtd, 0)),
        fmtNum(data.fornecedores.reduce((s, r) => s + r.litros, 0), 0),
        fmtBRL(data.fornecedores.reduce((s, r) => s + r.custo, 0)),
        ''],
      {
        0: { halign: 'right', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 110 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 36 },
        5: { halign: 'right', cellWidth: 26 },
      },
      MARCA,
    );
  }

  // Slot Anomalias placeholder — F3 retrofit sem refactor.
  const pageH = doc.internal.pageSize.getHeight();
  const yAnom = pageH - 50;
  drawPdfSectionTitle(doc, yAnom, 'ANOMALIAS DETECTADAS');
  doc.setTextColor(...PDF_RGB.cinzaMedio);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(
    'Detecção em desenvolvimento — disponível na próxima versão.',
    10, yAnom + 6,
  );

  doc.save(nomeArquivo(input, 'pdf'));
}

// ════════════════════════════════════════════════════════════════════
// Excel — workbook com 4 sheets:
//   Resumo · Saídas · Equipamentos · Fornecedores
// ════════════════════════════════════════════════════════════════════

export async function exportarPorObraExcel(input: PorObraInput): Promise<void> {
  const data = compute(input);
  const t = data.totais;
  const subtitulo = `${input.obra.nome} · ${formatMesRef(input.mesReferencia)}`;
  const eqMap = new Map(input.equipamentos.map((e) => [e.id, e]));
  const transpMap = new Map(input.transportadoras.map((tr) => [tr.id, tr.nome]));
  const combMap = new Map(input.combustiveis.map((c) => [c.id, c.nome]));

  const { wb, wsResumo, wsDetalhe } = createWorkbook();
  wsDetalhe.name = 'Saídas';

  // ── Resumo ──
  let row = renderExcelBanner(wsResumo, TITULO, subtitulo);
  row += 1;
  row = renderExcelFiltros(wsResumo, row, [
    ['Obra', input.obra.nome],
    ['Mês referência', formatMesRef(input.mesReferencia)],
    ['Status da obra', input.obra.status],
    ['Total saídas', `${t.qtdSaidas} registros`],
  ]);
  row += 1;
  renderExcelKPIs(wsResumo, row, [
    { label: 'Volume Total', value: t.volume, numFmt: '#,##0 "L"' },
    { label: 'Custo Total', value: t.custo, numFmt: '"R$" #,##0.00' },
    { label: 'R$/L Médio', value: t.rPorL, numFmt: '"R$" #,##0.0000' },
    { label: 'Saídas', value: t.qtdSaidas },
    { label: 'Equipamentos próprios', value: t.qtdEquipamentos },
    { label: 'Carretas', value: t.qtdCarretas },
    { label: 'Fornecedores (mês)', value: t.qtdFornecedores },
    { label: 'Compras (Entradas)', value: t.custoCompras, numFmt: '"R$" #,##0.00' },
  ]);

  if (t.qtdSentinel > 0) {
    row += 12;
    renderExcelSectionTitle(wsResumo, row, `Atenção: ${t.qtdSentinel} saída(s) sem equipamento identificado`);
    row += 1;
    wsResumo.getRow(row).getCell(1).value =
      'Atribuir retroativamente via aba "Saídas" (filtro "Apenas sem equipamento").';
    wsResumo.getRow(row).getCell(1).font = { italic: true, size: 9, color: { argb: BRAND.cinzaMedio } };
  }

  // ── Sheet "Saídas" ──
  renderExcelDetalhamento(wsDetalhe, data.saidasDesc, [
    { header: 'Data', key: 'data', width: 14, value: (s) => formatDateBR(s.data) },
    {
      header: 'Consumidor', key: 'cons', width: 40,
      value: (s) => {
        if (s.tipoConsumidor === 'equipamento_proprio') {
          if (s.equipamentoId === 'desconhecido') return 'Não identificado';
          const eq = s.equipamentoId ? eqMap.get(s.equipamentoId) : null;
          if (eq) {
            const codigo = eq.codigoPatrimonio || eq.tipo || '';
            return codigo ? `${codigo} · ${eq.nome}` : eq.nome;
          }
          return s.equipamentoId ?? '—';
        }
        const transp = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '') : '';
        return `${s.placa ?? '—'}${transp ? ` · ${transp}` : ''}`;
      },
    },
    { header: 'Tipo', key: 'tipo', width: 14, value: (s) => s.tipoConsumidor === 'equipamento_proprio' ? 'Equipamento' : 'Carreta' },
    { header: 'Combustível', key: 'comb', width: 18, value: (s) => combMap.get(s.tipoCombustivel) ?? s.tipoCombustivel },
    {
      header: 'Litros', key: 'litros', width: 12, align: 'right', numFmt: '#,##0',
      value: (s) => s.litros,
      footerValue: (items) => items.reduce((acc, s) => acc + s.litros, 0),
    },
    {
      header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000',
      value: (s) => (s.litros > 0 ? s.valorTotal / s.litros : 0),
    },
    {
      header: 'Custo', key: 'custo', width: 16, align: 'right', numFmt: '"R$" #,##0.00',
      value: (s) => s.valorTotal,
      footerValue: (items) => items.reduce((acc, s) => acc + s.valorTotal, 0),
    },
  ]);

  // ── Sheet "Equipamentos" (top + agregado) ──
  const rankEq = data.topEquipamentos.map((r, i) => ({ ...r, rank: i + 1 }));
  const wsEq = wb.addWorksheet('Equipamentos', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsEq, rankEq, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Equipamento', key: 'nome', width: 36, value: (r) => r.nome },
    { header: 'Código', key: 'codigo', width: 18, value: (r) => r.codigo },
    { header: 'Saídas', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // ── Sheet "Fornecedores" ──
  const rankForn = data.fornecedores.map((r, i) => ({ ...r, rank: i + 1 }));
  const wsForn = wb.addWorksheet('Fornecedores', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 } },
  });
  renderExcelDetalhamento(wsForn, rankForn, [
    { header: '#', key: 'rank', width: 6, align: 'right', value: (r) => r.rank },
    { header: 'Fornecedor', key: 'nome', width: 50, value: (r) => r.nome },
    { header: 'Compras', key: 'qtd', width: 10, align: 'right', value: (r) => r.qtd, footerValue: (items) => items.reduce((s, r) => s + r.qtd, 0) },
    { header: 'Litros', key: 'litros', width: 14, align: 'right', numFmt: '#,##0', value: (r) => r.litros, footerValue: (items) => items.reduce((s, r) => s + r.litros, 0) },
    { header: 'Custo', key: 'custo', width: 18, align: 'right', numFmt: '"R$" #,##0.00', value: (r) => r.custo, footerValue: (items) => items.reduce((s, r) => s + r.custo, 0) },
    { header: 'R$/L médio', key: 'rpl', width: 14, align: 'right', numFmt: '"R$" #,##0.0000', value: (r) => r.rPorL },
  ]);

  // Save
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo(input, 'xlsx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
