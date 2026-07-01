// Relatórios de manutenção em PDF.
//
// Task 3.2: Removida seção de preventivas/naoConformidades do mensal.
// Adicionada função exportarRelatorioPorMaquinaPdf (por máquina, com
// breakdown por categoria: peças/terceiros/óleos + subtotais).
// Reusa o template premium (banner verde + helpers drawPdf*).
//
// Estrutura do mensal (pós-Task 3.2):
//   Página 1 (Resumo):
//     - Banner + período
//     - KPIs do mês (serviços concluídos, custo)
//     - Top 10 equipamentos por custo
//     - Subtotais por categoria (peças/terceiros/óleos)
//   Página 2+:
//     - Tabela detalhada de serviços concluídos no período

import jsPDF from 'jspdf';
import {
  PDF_RGB,
  drawPdfBanner,
  drawPdfDetailPageHeader,
  drawPdfDetailTable,
  drawPdfFiltros,
  drawPdfKPIs,
  drawPdfMiniTable,
  drawPdfSectionTitle,
  fmtBRL,
  formatDateBR,
  makeFilename,
  sanitizeFilenamePart,
} from './exportTemplate';
import type {
  OrdemServico,
  Equipamento,
  TipoOS,
} from '../types';
import { TIPO_OS_LABEL } from '../types';
import { montarRelatorioPorMaquina } from './manutencaoRelatorio';

const SUBTITULO = 'Módulo de Manutenção · Gestão de Obras';
const FOOTER_MARCA = 'EMT Construtora · gestao-obras-rho.vercel.app';

export interface RelatorioMensalInput {
  mes: string;  // 'YYYY-MM'
  ordens: OrdemServico[];
  equipamentos: Equipamento[];
}

function inicioFimDoMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, mm] = mes.split('-').map(Number);
  const inicio = new Date(ano, mm - 1, 1);
  const fim = new Date(ano, mm, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

function mesPorExtenso(mes: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [ano, mm] = mes.split('-');
  const idx = parseInt(mm, 10) - 1;
  return `${meses[idx] ?? mm}/${ano}`;
}

export function exportarRelatorioMensalPdf(input: RelatorioMensalInput): void {
  const { mes, ordens, equipamentos } = input;
  const { inicio, fim } = inicioFimDoMes(mes);

  const equipMap = new Map(equipamentos.map((e) => [e.id, e]));

  // Filtra concluídas no período
  const ordensConcluidasMes = ordens.filter((o) => {
    if (o.status !== 'concluida') return false;
    const dataStr = (o.dataConclusao ?? o.dataAbertura ?? '').slice(0, 10);
    if (!dataStr) return false;
    const d = new Date(dataStr);
    return d >= inicio && d <= fim;
  });

  const { subtotais } = montarRelatorioPorMaquina(ordensConcluidasMes);
  const custoMes = subtotais.total;

  // Top 10 por custo no mês
  const custoPorEq = new Map<string, { total: number; numOS: number; tipo: string; nome: string }>();
  for (const o of ordensConcluidasMes) {
    const eq = equipMap.get(o.equipamentoId);
    const key = o.equipamentoId;
    const v = custoPorEq.get(key) ?? {
      total: 0, numOS: 0,
      tipo: eq?.tipo ?? '—',
      nome: eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : key,
    };
    v.total += o.custoTotal ?? 0;
    v.numOS += 1;
    custoPorEq.set(key, v);
  }
  const top10 = Array.from(custoPorEq.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // --- Início do PDF ---
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawPdfBanner(doc, `Relatório de Manutenção · ${mesPorExtenso(mes)}`, SUBTITULO);

  // Filtros / resumo do período
  y = drawPdfFiltros(doc, y, [
    ['Período', `${formatDateBR(inicio.toISOString().slice(0, 10))} a ${formatDateBR(fim.toISOString().slice(0, 10))}`],
    ['Serviços concluídos', `${ordensConcluidasMes.length}`],
    ['Frota ativa', `${equipamentos.filter((e) => e.ativo !== false).length} equipamentos`],
  ]);

  // KPIs
  y = drawPdfKPIs(doc, y, [
    ['Custo do mês', fmtBRL(custoMes, 0)],
    ['Peças', fmtBRL(subtotais.pecas, 0)],
    ['Terceiros', fmtBRL(subtotais.terceiros, 0)],
    ['Óleos', fmtBRL(subtotais.oleos, 0)],
  ]);

  // Mini-tabela: Top 10 por custo
  if (top10.length > 0) {
    y = drawPdfMiniTable(
      doc,
      y,
      'TOP 10 EQUIPAMENTOS POR CUSTO NO MÊS',
      ['#', 'Equipamento', 'Tipo', 'Serviços', 'Custo'],
      top10.map((t, i) => [
        `${i + 1}`,
        t.nome,
        t.tipo,
        t.numOS,
        fmtBRL(t.total),
      ]),
      ['', 'TOTAL', '', top10.reduce((s, t) => s + t.numOS, 0),
        fmtBRL(top10.reduce((s, t) => s + t.total, 0))],
      {
        0: { halign: 'center', cellWidth: 8 },
        2: { halign: 'left', cellWidth: 40 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'right', cellWidth: 30 },
      }
    );
  }

  // Mini-tabela: Subtotais por categoria
  y = drawPdfMiniTable(
    doc,
    y,
    'CUSTO POR CATEGORIA',
    ['Categoria', 'Valor', '% do total'],
    [
      ['Peças', fmtBRL(subtotais.pecas), custoMes > 0 ? `${(subtotais.pecas / custoMes * 100).toFixed(1)}%` : '—'],
      ['Serviços de terceiros', fmtBRL(subtotais.terceiros), custoMes > 0 ? `${(subtotais.terceiros / custoMes * 100).toFixed(1)}%` : '—'],
      ['Óleos e lubrificantes', fmtBRL(subtotais.oleos), custoMes > 0 ? `${(subtotais.oleos / custoMes * 100).toFixed(1)}%` : '—'],
    ],
    ['TOTAL', fmtBRL(custoMes), '100%'],
    {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 25 },
    }
  );

  // --- Página de detalhe: serviços concluídos no período ---
  if (ordensConcluidasMes.length > 0) {
    doc.addPage();
    const startY = drawPdfDetailPageHeader(
      doc,
      `SERVIÇOS CONCLUÍDOS · ${mesPorExtenso(mes)}`,
      ordensConcluidasMes.length
    );

    const ordenadas = [...ordensConcluidasMes].sort((a, b) => {
      const da = (a.dataConclusao ?? a.dataAbertura ?? '');
      const db = (b.dataConclusao ?? b.dataAbertura ?? '');
      return db.localeCompare(da);
    });

    drawPdfDetailTable(
      doc,
      startY,
      ['Número', 'Equipamento', 'Tipo', 'Data', 'Peças', 'Terceiros', 'Óleos', 'Total'],
      ordenadas.map((o) => {
        const eq = equipMap.get(o.equipamentoId);
        const dataStr = (o.dataConclusao ?? o.dataAbertura ?? '').slice(0, 10);
        return [
          o.numero,
          eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : o.equipamentoId,
          TIPO_OS_LABEL[o.tipo as TipoOS] ?? o.tipo,
          dataStr ? formatDateBR(dataStr) : '—',
          fmtBRL(o.custoPecas ?? 0),
          fmtBRL(o.custoTerceiros ?? 0),
          fmtBRL(o.custoOleos ?? 0),
          fmtBRL(o.custoTotal ?? 0),
        ];
      }),
      ['', '', '', 'TOTAL',
        fmtBRL(subtotais.pecas),
        fmtBRL(subtotais.terceiros),
        fmtBRL(subtotais.oleos),
        fmtBRL(subtotais.total)],
      {
        0: { cellWidth: 24 },
        1: { cellWidth: 55 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
      },
      FOOTER_MARCA
    );
  } else {
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    y = drawPdfSectionTitle(doc, y + 4, 'SERVIÇOS CONCLUÍDOS NO PERÍODO');
    doc.text('Nenhum serviço concluído no período.', 10, y + 2);
  }

  doc.save(makeFilename(`Manutencao-Mensal-${mes}`, 'pdf'));
}

// =====================================================================
// Relatório Anual
// =====================================================================

export interface RelatorioAnualInput {
  ano: number;
  ordens: OrdemServico[];
  equipamentos: Equipamento[];
  ordensAnoAnterior?: OrdemServico[];
}

const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export function exportarRelatorioAnualPdf(input: RelatorioAnualInput): void {
  const { ano, ordens, equipamentos, ordensAnoAnterior = [] } = input;
  const inicio = new Date(ano, 0, 1);
  const fim = new Date(ano, 11, 31, 23, 59, 59, 999);

  const equipMap = new Map(equipamentos.map((e) => [e.id, e]));

  // Filtra concluídas do ano
  const concluidasAno = ordens.filter((o) => {
    if (o.status !== 'concluida') return false;
    const dataStr = (o.dataConclusao ?? o.dataAbertura ?? '').slice(0, 10);
    if (!dataStr) return false;
    const d = new Date(dataStr);
    return d >= inicio && d <= fim;
  });

  const { subtotais: subtotaisAno } = montarRelatorioPorMaquina(concluidasAno);
  const custoAno = subtotaisAno.total;

  const custoAnoAnt = ordensAnoAnterior
    .filter((o) => {
      if (o.status !== 'concluida') return false;
      const dataStr = (o.dataConclusao ?? o.dataAbertura ?? '').slice(0, 10);
      if (!dataStr) return false;
      return new Date(dataStr).getFullYear() === ano - 1;
    })
    .reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const variacaoAno = custoAnoAnt > 0 ? ((custoAno - custoAnoAnt) / custoAnoAnt) * 100 : null;

  // Breakdown mensal
  const custoPorMes: number[] = new Array(12).fill(0);
  const numOSPorMes: number[] = new Array(12).fill(0);
  for (const o of concluidasAno) {
    const dataStr = (o.dataConclusao ?? o.dataAbertura ?? '').slice(0, 10);
    if (!dataStr) continue;
    const m = new Date(dataStr).getMonth();
    custoPorMes[m] += o.custoTotal ?? 0;
    numOSPorMes[m] += 1;
  }

  // Top 20 equipamentos por custo no ano
  const custoPorEq = new Map<string, { total: number; numOS: number; tipo: string; nome: string }>();
  for (const o of concluidasAno) {
    const eq = equipMap.get(o.equipamentoId);
    const key = o.equipamentoId;
    const v = custoPorEq.get(key) ?? {
      total: 0, numOS: 0,
      tipo: eq?.tipo ?? '—',
      nome: eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : key,
    };
    v.total += o.custoTotal ?? 0;
    v.numOS += 1;
    custoPorEq.set(key, v);
  }
  const top20 = Array.from(custoPorEq.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // PDF
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawPdfBanner(doc, `Relatório Anual de Manutenção · ${ano}`, SUBTITULO);

  y = drawPdfFiltros(doc, y, [
    ['Período', `01/01/${ano} a 31/12/${ano}`],
    ['Serviços concluídos', `${concluidasAno.length}`],
    ['Frota considerada', `${equipamentos.filter((e) => e.ativo !== false).length} equipamentos`],
    ['Ano anterior', custoAnoAnt > 0 ? fmtBRL(custoAnoAnt, 0) : 'sem dados'],
  ]);

  y = drawPdfKPIs(doc, y, [
    ['Custo do ano', fmtBRL(custoAno, 0)],
    ['vs Ano anterior', variacaoAno != null
      ? `${variacaoAno > 0 ? '+' : ''}${variacaoAno.toFixed(0)}%`
      : '—'],
    ['Peças', fmtBRL(subtotaisAno.pecas, 0)],
    ['Óleos', fmtBRL(subtotaisAno.oleos, 0)],
  ]);

  // Mini-tabela: breakdown mensal
  y = drawPdfMiniTable(
    doc,
    y,
    `CUSTO MENSAL · ${ano}`,
    ['Mês', 'Serviços concluídos', 'Custo'],
    custoPorMes.map((c, m) => [MESES_CURTOS[m], numOSPorMes[m], fmtBRL(c)]),
    ['TOTAL', concluidasAno.length, fmtBRL(custoAno)],
    {
      0: { halign: 'center', cellWidth: 25 },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 40 },
    }
  );

  // Distribuição por categoria
  drawPdfMiniTable(
    doc,
    y,
    'DISTRIBUIÇÃO DE CUSTO POR CATEGORIA',
    ['Categoria', 'Custo', '% do total'],
    [
      ['Peças', fmtBRL(subtotaisAno.pecas), custoAno > 0 ? `${(subtotaisAno.pecas / custoAno * 100).toFixed(1)}%` : '—'],
      ['Serviços de terceiros', fmtBRL(subtotaisAno.terceiros), custoAno > 0 ? `${(subtotaisAno.terceiros / custoAno * 100).toFixed(1)}%` : '—'],
      ['Óleos e lubrificantes', fmtBRL(subtotaisAno.oleos), custoAno > 0 ? `${(subtotaisAno.oleos / custoAno * 100).toFixed(1)}%` : '—'],
    ],
    ['TOTAL', fmtBRL(custoAno), '100%'],
    {
      0: { halign: 'left', cellWidth: 60 },
      1: { halign: 'right', cellWidth: 45 },
      2: { halign: 'right', cellWidth: 30 },
    }
  );

  // Top 20 — vai pra nova página
  doc.addPage();
  const startY = drawPdfDetailPageHeader(doc, `TOP 20 EQUIPAMENTOS POR CUSTO · ${ano}`, top20.length);

  drawPdfDetailTable(
    doc,
    startY,
    ['#', 'Equipamento', 'Tipo', 'Serviços', 'Custo', '% do total'],
    top20.map((t, i) => [
      `${i + 1}`,
      t.nome,
      t.tipo,
      t.numOS,
      fmtBRL(t.total),
      custoAno > 0 ? `${(t.total / custoAno * 100).toFixed(1)}%` : '—',
    ]),
    ['', '', '',
      top20.reduce((s, t) => s + t.numOS, 0),
      fmtBRL(top20.reduce((s, t) => s + t.total, 0)),
      custoAno > 0
        ? `${(top20.reduce((s, t) => s + t.total, 0) / custoAno * 100).toFixed(1)}%`
        : '—'],
    {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 100 },
      2: { halign: 'left', cellWidth: 45 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 25 },
    },
    FOOTER_MARCA
  );

  doc.save(makeFilename(`Manutencao-Anual-${ano}`, 'pdf'));
}

// =====================================================================
// Relatório por Equipamento (histórico completo)
// =====================================================================

export interface RelatorioEquipamentoInput {
  equipamento: Equipamento;
  ordens: OrdemServico[];
  medicaoAtual: number | null;
  custoPecasUltimo12m?: number;
}

export function exportarRelatorioEquipamentoPdf(input: RelatorioEquipamentoInput): void {
  const { equipamento: eq, ordens, medicaoAtual, custoPecasUltimo12m = 0 } = input;

  // Filtra OSs deste equipamento
  const ordensEq = [...ordens]
    .filter((o) => o.equipamentoId === eq.id)
    .sort((a, b) => (b.dataAbertura ?? '').localeCompare(a.dataAbertura ?? ''));

  const ordensConcluidas = ordensEq.filter((o) => o.status === 'concluida');
  const { subtotais } = montarRelatorioPorMaquina(ordensConcluidas);
  const custoTotal = subtotais.total;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const titulo = `Histórico · ${eq.codigoPatrimonio ?? eq.nome}`;
  let y = drawPdfBanner(doc, titulo, SUBTITULO);

  // Identificação do equipamento
  y = drawPdfFiltros(doc, y, [
    ['Nome', eq.nome],
    ['Patrimônio', eq.codigoPatrimonio || '—'],
    ['Tipo', eq.tipo || '—'],
    ['Marca / Modelo', [eq.marca, eq.modelo].filter(Boolean).join(' ') || '—'],
    ['Ano', eq.ano || '—'],
    ['Propriedade', eq.propriedade === 'alugada' ? 'Alugado' : 'Próprio'],
    ['Status atual', eq.status],
    ['Medição atual', medicaoAtual != null
      ? `${medicaoAtual.toLocaleString('pt-BR')} ${eq.tipoMedicao === 'horimetro' ? 'h' : 'km'}`
      : '—'],
  ]);

  // KPIs
  y = drawPdfKPIs(doc, y, [
    ['Serviços totais', `${ordensEq.length}`],
    ['Custo total', fmtBRL(custoTotal, 0)],
    ['Peças', fmtBRL(subtotais.pecas, 0)],
    ['Óleos', fmtBRL(subtotais.oleos, 0)],
  ]);

  // Distribuição de custos por categoria
  drawPdfMiniTable(
    doc,
    y,
    'DISTRIBUIÇÃO DE CUSTO POR CATEGORIA',
    ['Categoria', 'Valor', '% do total'],
    [
      ['Peças', fmtBRL(subtotais.pecas),
        custoTotal > 0 ? `${(subtotais.pecas / custoTotal * 100).toFixed(1)}%` : '—'],
      ['Serviços de terceiros', fmtBRL(subtotais.terceiros),
        custoTotal > 0 ? `${(subtotais.terceiros / custoTotal * 100).toFixed(1)}%` : '—'],
      ['Óleos e lubrificantes', fmtBRL(subtotais.oleos),
        custoTotal > 0 ? `${(subtotais.oleos / custoTotal * 100).toFixed(1)}%` : '—'],
      ['Peças (últimos 12m)', fmtBRL(custoPecasUltimo12m), '—'],
    ],
    ['TOTAL', fmtBRL(custoTotal), '100%'],
    {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 45 },
      2: { halign: 'right', cellWidth: 30 },
    }
  );

  // Tabela detalhada — nova página
  if (ordensEq.length > 0) {
    doc.addPage();
    const startY = drawPdfDetailPageHeader(doc, 'SERVIÇOS DO EQUIPAMENTO', ordensEq.length);
    drawPdfDetailTable(
      doc,
      startY,
      ['Número', 'Tipo', 'Abertura', 'Conclusão', 'Peças', 'Terceiros', 'Óleos', 'Total'],
      ordensEq.map((o) => [
        o.numero,
        TIPO_OS_LABEL[o.tipo as TipoOS] ?? o.tipo,
        o.dataAbertura ? formatDateBR(o.dataAbertura.slice(0, 10)) : '—',
        o.dataConclusao ? formatDateBR(o.dataConclusao.slice(0, 10)) : '—',
        fmtBRL(o.custoPecas ?? 0),
        fmtBRL(o.custoTerceiros ?? 0),
        fmtBRL(o.custoOleos ?? 0),
        fmtBRL(o.custoTotal ?? 0),
      ]),
      ['', '', '', 'TOTAL',
        fmtBRL(subtotais.pecas),
        fmtBRL(subtotais.terceiros),
        fmtBRL(subtotais.oleos),
        fmtBRL(custoTotal)],
      {
        0: { cellWidth: 26 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 22 },
        7: { halign: 'right', cellWidth: 24 },
      },
      FOOTER_MARCA
    );
  }

  doc.save(makeFilename(`Equipamento-${eq.codigoPatrimonio || eq.id}`, 'pdf'));
}

// =====================================================================
// Relatório por Máquina (período específico)
// =====================================================================

export interface RelatorioPorMaquinaPdfInput {
  equipamento: { id: string; nome: string; codigoPatrimonio?: string; tipo?: string };
  periodo: { de: string; ate: string };
  servicos: OrdemServico[];
}

export function exportarRelatorioPorMaquinaPdf(input: RelatorioPorMaquinaPdfInput): void {
  const { equipamento, periodo, servicos } = input;
  const { linhas, subtotais } = montarRelatorioPorMaquina(servicos);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const titulo = `Relatório por Máquina · ${equipamento.codigoPatrimonio ?? equipamento.nome}`;
  let y = drawPdfBanner(doc, titulo, SUBTITULO);

  const deLabel = periodo.de ? formatDateBR(periodo.de) : '—';
  const ateLabel = periodo.ate ? formatDateBR(periodo.ate) : '—';
  const fmtPeriodo = `${deLabel} a ${ateLabel}`;
  y = drawPdfFiltros(doc, y, [
    ['Equipamento', equipamento.nome],
    ['Período', fmtPeriodo],
    ['Serviços concluídos', `${linhas.length}`],
  ]);

  y = drawPdfKPIs(doc, y, [
    ['Custo total', fmtBRL(subtotais.total, 0)],
    ['Peças', fmtBRL(subtotais.pecas, 0)],
    ['Terceiros', fmtBRL(subtotais.terceiros, 0)],
    ['Óleos', fmtBRL(subtotais.oleos, 0)],
  ]);

  // Subtotais por categoria
  drawPdfMiniTable(
    doc,
    y,
    'CUSTO POR CATEGORIA',
    ['Categoria', 'Valor', '% do total'],
    [
      ['Peças', fmtBRL(subtotais.pecas), subtotais.total > 0 ? `${(subtotais.pecas / subtotais.total * 100).toFixed(1)}%` : '—'],
      ['Serviços de terceiros', fmtBRL(subtotais.terceiros), subtotais.total > 0 ? `${(subtotais.terceiros / subtotais.total * 100).toFixed(1)}%` : '—'],
      ['Óleos e lubrificantes', fmtBRL(subtotais.oleos), subtotais.total > 0 ? `${(subtotais.oleos / subtotais.total * 100).toFixed(1)}%` : '—'],
    ],
    ['TOTAL', fmtBRL(subtotais.total), '100%'],
    {
      0: { halign: 'left', cellWidth: 70 },
      1: { halign: 'right', cellWidth: 40 },
      2: { halign: 'right', cellWidth: 25 },
    }
  );

  // Tabela de serviços
  if (linhas.length > 0) {
    doc.addPage();
    const startY = drawPdfDetailPageHeader(doc, 'SERVIÇOS DO PERÍODO', linhas.length);
    drawPdfDetailTable(
      doc,
      startY,
      ['Número', 'Data', 'Tipo', 'Peças', 'Terceiros', 'Óleos', 'Total'],
      linhas.map((l) => [
        l.numero,
        l.data ? formatDateBR(l.data) : '—',
        l.tipo,
        fmtBRL(l.custoPecas),
        fmtBRL(l.custoTerceiros),
        fmtBRL(l.custoOleos),
        fmtBRL(l.custoTotal),
      ]),
      ['', 'TOTAL', '',
        fmtBRL(subtotais.pecas),
        fmtBRL(subtotais.terceiros),
        fmtBRL(subtotais.oleos),
        fmtBRL(subtotais.total)],
      {
        0: { cellWidth: 28 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'left', cellWidth: 50 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 25 },
        6: { halign: 'right', cellWidth: 28 },
      },
      FOOTER_MARCA
    );
  }

  const nomeFile = sanitizeFilenamePart(equipamento.codigoPatrimonio ?? equipamento.nome).slice(0, 30);
  doc.save(makeFilename(`Manutencao-Maquina-${nomeFile}`, 'pdf'));
}
