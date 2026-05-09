// RelatoriosTab — orquestrador da aba "Relatórios" (F4).
// F4.A.1 entrega 1 template ("Mensal Consolidado"). F4.B/C adicionam mais
// cards conforme cada template chegar.

import { useState } from 'react';
import { CalendarDays, FileText, ClipboardList, FileSpreadsheet } from 'lucide-react';
import type {
  EntradaCombustivel,
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
} from '../../../../types';
import MensalConsolidadoModal from './MensalConsolidadoModal';

interface Props {
  saidas: SaidaCombustivel[];
  entradas: EntradaCombustivel[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  obras: Obra[];
  combustiveis: Insumo[];
}

export default function RelatoriosTab(props: Props) {
  const [modalMensal, setModalMensal] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">Relatórios</h2>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
          Templates branded em PDF e Excel. Pré-formatados pra entrega externa (DNIT, contadores, stakeholders).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* F4.A.1: Mensal Consolidado */}
        <button
          type="button"
          onClick={() => setModalMensal(true)}
          className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 text-left shadow-[var(--shadow-xs)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[var(--color-accent)]"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-fg)]">Mensal Consolidado</div>
              <div className="text-[11px] text-[var(--color-fg-muted)]">Visão executiva do mês</div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-fg-muted)] leading-relaxed mb-3">
            KPIs gerais, top 10 equipamentos próprios, top 10 carretas, top 10 obras por custo,
            resumo de fornecedores. Default: mês anterior.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-fg-subtle)]">
            <FileText className="w-3 h-3" /> PDF
            <span>·</span>
            <FileSpreadsheet className="w-3 h-3" /> Excel
          </div>
        </button>

        {/* F4.B: Por Obra (em breve) */}
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-5 opacity-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-[var(--color-fg-subtle)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-fg-muted)]">Por Obra</div>
              <div className="text-[11px] text-[var(--color-fg-subtle)]">Em breve · F4.B</div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed italic">
            Detalhamento de uma obra específica: saídas, custo, equipamentos, fornecedores associados.
          </p>
        </div>

        {/* F4.B: Por Equipamento (em breve) */}
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-5 opacity-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-[var(--color-fg-subtle)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-fg-muted)]">Por Equipamento</div>
              <div className="text-[11px] text-[var(--color-fg-subtle)]">Em breve · F4.B</div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed italic">
            Histórico de consumo de um equipamento, R$/L, obras frequentes, médias do período.
          </p>
        </div>

        {/* F4.C: Raw Export (em breve) */}
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)]/30 p-5 opacity-60">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[var(--color-fg-subtle)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-fg-muted)]">Raw export</div>
              <div className="text-[11px] text-[var(--color-fg-subtle)]">Em breve · F4.C</div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed italic">
            Excel multi-aba com todas as saídas, entradas e transferências do período (sem agregações).
          </p>
        </div>
      </div>

      <MensalConsolidadoModal
        open={modalMensal}
        onClose={() => setModalMensal(false)}
        saidas={props.saidas}
        entradas={props.entradas}
        equipamentos={props.equipamentos}
        transportadoras={props.transportadoras}
        obras={props.obras}
        combustiveis={props.combustiveis}
      />
    </div>
  );
}
