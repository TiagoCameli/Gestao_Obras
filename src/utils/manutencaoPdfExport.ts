// Marco 6 / PR28 — Relatório mensal de manutenção em PDF.
//
// Reusa o template premium (banner verde + helpers drawPdf*). Estrutura:
//   Página 1 (Resumo):
//     - Banner + período
//     - KPIs do mês (OS abertas/concluídas/custo)
//     - Mini-tabela top 10 equipamentos por custo
//     - Mini-tabela preventivas vencidas snapshot atual
//   Página 2+:
//     - Tabela detalhada de OSs concluídas no período
//   Página final: não-conformidades de checklists em aberto

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
} from './exportTemplate';
import type {
  OrdemServico,
  Equipamento,
  StatusOS,
  TipoOS,
} from '../types';
import { STATUS_OS_LABEL, TIPO_OS_LABEL } from '../types';
import type { ProximaPreventiva } from '../types';
import type { ChecklistNaoConformidade } from '../hooks/useChecklistNaoConformidades';

const SUBTITULO = 'Módulo de Manutenção · Gestão de Obras';
const FOOTER_MARCA = 'EMT Construtora · gestao-obras-rho.vercel.app';

export interface RelatorioMensalInput {
  mes: string;  // 'YYYY-MM'
  ordens: OrdemServico[];
  equipamentos: Equipamento[];
  proximasPreventivas: ProximaPreventiva[];
  naoConformidades: ChecklistNaoConformidade[];
}

function inicioFimDoMes(mes: string): { inicio: Date; fim: Date } {
  const [ano, mm] = mes.split('-').map(Number);
  const inicio = new Date(ano, mm - 1, 1);
  const fim = new Date(ano, mm, 0, 23, 59, 59, 999);  // último dia
  return { inicio, fim };
}

function mesPorExtenso(mes: string): string {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const [ano, mm] = mes.split('-');
  const idx = parseInt(mm, 10) - 1;
  return `${meses[idx] ?? mm}/${ano}`;
}

function horasEntre(inicio: string | null, fim: string | null): number {
  if (!inicio || !fim) return 0;
  const ms = new Date(fim).getTime() - new Date(inicio).getTime();
  return Math.max(0, ms / 3_600_000);
}

export function exportarRelatorioMensalPdf(input: RelatorioMensalInput): void {
  const { mes, ordens, equipamentos, proximasPreventivas, naoConformidades } = input;
  const { inicio, fim } = inicioFimDoMes(mes);

  const equipMap = new Map(equipamentos.map((e) => [e.id, e]));

  // --- Filtrar dados do período ---
  const ordensConcluidasMes = ordens.filter((o) => {
    if (!o.dataConclusao) return false;
    const d = new Date(o.dataConclusao);
    return d >= inicio && d <= fim;
  });
  const ordensAbertasMes = ordens.filter((o) => {
    if (!o.dataAbertura) return false;
    const d = new Date(o.dataAbertura);
    return d >= inicio && d <= fim;
  });

  const custoMes = ordensConcluidasMes.reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const custoCorretivo = ordensConcluidasMes
    .filter((o) => o.tipo === 'corretiva')
    .reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const percCorretivo = custoMes > 0 ? (custoCorretivo / custoMes) * 100 : 0;

  const tempos = ordensConcluidasMes
    .map((o) => horasEntre(o.dataAbertura, o.dataConclusao))
    .filter((h) => h > 0);
  const mttr = tempos.length > 0 ? tempos.reduce((s, h) => s + h, 0) / tempos.length : null;

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

  // Preventivas vencidas (snapshot)
  const preventivasVencidas = proximasPreventivas
    .filter((p) => {
      if (p.unidadesRestantes != null && p.unidadesRestantes < 0) return true;
      if (p.diasRestantes != null && p.diasRestantes < 0) return true;
      return false;
    })
    .sort((a, b) => {
      const va = a.unidadesRestantes ?? a.diasRestantes ?? 0;
      const vb = b.unidadesRestantes ?? b.diasRestantes ?? 0;
      return va - vb;
    })
    .slice(0, 15);

  // --- Início do PDF ---
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = drawPdfBanner(doc, `Relatório de Manutenção · ${mesPorExtenso(mes)}`, SUBTITULO);

  // Filtros aplicados (mais resumo do período)
  y = drawPdfFiltros(doc, y, [
    ['Período', `${formatDateBR(inicio.toISOString().slice(0, 10))} a ${formatDateBR(fim.toISOString().slice(0, 10))}`],
    ['OSs concluídas', `${ordensConcluidasMes.length}`],
    ['OSs abertas no período', `${ordensAbertasMes.length}`],
    ['Frota ativa', `${equipamentos.filter((e) => e.ativo !== false).length} equipamentos`],
  ]);

  // KPIs
  y = drawPdfKPIs(doc, y, [
    ['Custo do mês', fmtBRL(custoMes, 0)],
    ['% Corretivo', custoMes > 0 ? `${percCorretivo.toFixed(0)}%` : '—'],
    ['MTTR', mttr != null ? `${mttr.toFixed(1)} h` : '—'],
    ['Preventivas vencidas', `${preventivasVencidas.length}`],
  ]);

  // Mini-tabela: Top 10 por custo
  if (top10.length > 0) {
    y = drawPdfMiniTable(
      doc,
      y,
      'TOP 10 EQUIPAMENTOS POR CUSTO NO MÊS',
      ['#', 'Equipamento', 'Tipo', 'OSs', 'Custo'],
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

  // Mini-tabela: Preventivas vencidas (snapshot)
  if (preventivasVencidas.length > 0) {
    y = drawPdfMiniTable(
      doc,
      y,
      `PREVENTIVAS VENCIDAS (SNAPSHOT EM ${formatDateBR(new Date().toISOString().slice(0, 10))})`,
      ['Equipamento', 'Atividade', 'Categoria', 'Atraso'],
      preventivasVencidas.map((p) => {
        const atrasoUnid = p.unidadesRestantes != null && p.unidadesRestantes < 0
          ? `${Math.abs(p.unidadesRestantes).toLocaleString('pt-BR')} ${p.tipoMedicao === 'horimetro' ? 'h' : 'km'}`
          : '';
        const atrasoDias = p.diasRestantes != null && p.diasRestantes < 0
          ? `${Math.abs(p.diasRestantes)} dia${Math.abs(p.diasRestantes) > 1 ? 's' : ''}`
          : '';
        const atraso = [atrasoUnid, atrasoDias].filter(Boolean).join(' / ');
        return [
          `${p.codigoPatrimonio} · ${p.equipamentoNome}`,
          p.atividadeNome,
          p.categoria ?? '—',
          atraso,
        ];
      }),
      ['', '', `Total: ${preventivasVencidas.length}`, ''],
      {
        2: { halign: 'left' },
        3: { halign: 'right', cellWidth: 35 },
      }
    );
  }

  // Não-conformidades (resumo)
  const ncBloqueadas = naoConformidades.filter((nc) => nc.status === 'bloqueado');
  if (ncBloqueadas.length > 0) {
    y = drawPdfMiniTable(
      doc,
      y,
      'EQUIPAMENTOS BLOQUEADOS POR CHECKLIST',
      ['Equipamento', 'Operador', 'Não-conf.', 'Críticas', 'Data'],
      ncBloqueadas.map((nc) => [
        `${nc.codigoPatrimonio} · ${nc.equipamentoNome}`,
        nc.operadorNome || '—',
        nc.itensNao,
        nc.itensCriticos,
        formatDateBR(nc.concluidoEm.slice(0, 10)),
      ]),
      ['', `Total: ${ncBloqueadas.length}`, '', '', ''],
      {
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 22 },
      }
    );
  }

  // --- Página de detalhe: OSs concluídas no período ---
  if (ordensConcluidasMes.length > 0) {
    doc.addPage();
    const startY = drawPdfDetailPageHeader(
      doc,
      `OSs CONCLUÍDAS · ${mesPorExtenso(mes)}`,
      ordensConcluidasMes.length
    );

    const ordensOrdenadas = [...ordensConcluidasMes].sort((a, b) =>
      (b.dataConclusao ?? '').localeCompare(a.dataConclusao ?? '')
    );

    drawPdfDetailTable(
      doc,
      startY,
      ['Número', 'Equipamento', 'Tipo', 'Status', 'Defeito', 'Custo', 'Conclusão'],
      ordensOrdenadas.map((o) => {
        const eq = equipMap.get(o.equipamentoId);
        return [
          o.numero,
          eq ? (eq.codigoPatrimonio ? `${eq.codigoPatrimonio} · ${eq.nome}` : eq.nome) : o.equipamentoId,
          TIPO_OS_LABEL[o.tipo as TipoOS] ?? o.tipo,
          STATUS_OS_LABEL[o.status as StatusOS] ?? o.status,
          (o.defeitoReportado ?? '').slice(0, 60) + ((o.defeitoReportado?.length ?? 0) > 60 ? '…' : ''),
          fmtBRL(o.custoTotal ?? 0),
          o.dataConclusao ? formatDateBR(o.dataConclusao.slice(0, 10)) : '—',
        ];
      }),
      ['', '', '', '', 'TOTAL',
        fmtBRL(ordensConcluidasMes.reduce((s, o) => s + (o.custoTotal ?? 0), 0)),
        ''],
      {
        0: { cellWidth: 28 },
        1: { cellWidth: 60 },
        2: { cellWidth: 22, halign: 'center' },
        3: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 28, halign: 'right' },
        6: { cellWidth: 22, halign: 'center' },
      },
      FOOTER_MARCA
    );
  } else {
    // Adicionar nota de "nenhuma OS concluída no período"
    doc.setTextColor(...PDF_RGB.cinzaMedio);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    y = drawPdfSectionTitle(doc, y + 4, 'OSs CONCLUÍDAS NO PERÍODO');
    doc.text('Nenhuma OS concluída no período.', 10, y + 2);
  }

  // Salvar
  const filename = makeFilename(`Manutencao-Mensal-${mes}`, 'pdf');
  doc.save(filename);
}

// =====================================================================
// Relatório Anual
// =====================================================================

export interface RelatorioAnualInput {
  ano: number;
  ordens: OrdemServico[];
  equipamentos: Equipamento[];
  /** Para comparação ano-a-ano, opcionalmente passe um snapshot ano anterior. */
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
    if (!o.dataConclusao) return false;
    const d = new Date(o.dataConclusao);
    return d >= inicio && d <= fim;
  });

  // KPIs anuais
  const custoAno = concluidasAno.reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const custoCorretivo = concluidasAno
    .filter((o) => o.tipo === 'corretiva')
    .reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const custoPreventivo = concluidasAno
    .filter((o) => o.tipo === 'preventiva')
    .reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const percCorretivo = custoAno > 0 ? (custoCorretivo / custoAno) * 100 : 0;
  const tempos = concluidasAno
    .map((o) => horasEntre(o.dataAbertura, o.dataConclusao))
    .filter((h) => h > 0);
  const mttrAno = tempos.length > 0 ? tempos.reduce((s, h) => s + h, 0) / tempos.length : null;

  // Variação ano anterior
  const custoAnoAnt = ordensAnoAnterior
    .filter((o) => {
      if (!o.dataConclusao) return false;
      const d = new Date(o.dataConclusao);
      return d.getFullYear() === ano - 1;
    })
    .reduce((s, o) => s + (o.custoTotal ?? 0), 0);
  const variacaoAno = custoAnoAnt > 0 ? ((custoAno - custoAnoAnt) / custoAnoAnt) * 100 : null;

  // Breakdown mensal
  const custoPorMes: number[] = new Array(12).fill(0);
  const numOSPorMes: number[] = new Array(12).fill(0);
  for (const o of concluidasAno) {
    if (!o.dataConclusao) continue;
    const m = new Date(o.dataConclusao).getMonth();
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
    ['OSs concluídas', `${concluidasAno.length}`],
    ['Frota considerada', `${equipamentos.filter((e) => e.ativo !== false).length} equipamentos`],
    ['Ano anterior', custoAnoAnt > 0 ? fmtBRL(custoAnoAnt, 0) : 'sem dados'],
  ]);

  // KPIs anuais
  y = drawPdfKPIs(doc, y, [
    ['Custo do ano', fmtBRL(custoAno, 0)],
    ['vs Ano anterior', variacaoAno != null
      ? `${variacaoAno > 0 ? '+' : ''}${variacaoAno.toFixed(0)}%`
      : '—'],
    ['MTTR médio', mttrAno != null ? `${mttrAno.toFixed(1)} h` : '—'],
    ['% Corretivo', custoAno > 0 ? `${percCorretivo.toFixed(0)}%` : '—'],
  ]);

  // Mini-tabela: breakdown mensal
  y = drawPdfMiniTable(
    doc,
    y,
    `CUSTO MENSAL · ${ano}`,
    ['Mês', 'OSs concluídas', 'Custo'],
    custoPorMes.map((c, m) => [MESES_CURTOS[m], numOSPorMes[m], fmtBRL(c)]),
    ['TOTAL', concluidasAno.length, fmtBRL(custoAno)],
    {
      0: { halign: 'center', cellWidth: 25 },
      1: { halign: 'center', cellWidth: 35 },
      2: { halign: 'right', cellWidth: 40 },
    }
  );

  // Comparação corretivo vs preventivo
  drawPdfMiniTable(
    doc,
    y,
    'DISTRIBUIÇÃO DE CUSTO POR TIPO',
    ['Tipo de OS', 'Custo', '% do total'],
    [
      ['Corretiva', fmtBRL(custoCorretivo), custoAno > 0 ? `${percCorretivo.toFixed(1)}%` : '—'],
      ['Preventiva', fmtBRL(custoPreventivo), custoAno > 0 ? `${(custoPreventivo / custoAno * 100).toFixed(1)}%` : '—'],
      ['Outros', fmtBRL(custoAno - custoCorretivo - custoPreventivo),
        custoAno > 0 ? `${((custoAno - custoCorretivo - custoPreventivo) / custoAno * 100).toFixed(1)}%` : '—'],
    ],
    ['TOTAL', fmtBRL(custoAno), '100%'],
    {
      0: { halign: 'left', cellWidth: 40 },
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
    ['#', 'Equipamento', 'Tipo', 'OSs', 'Custo', '% do total'],
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
