import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../shadcn/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../shadcn/command';
import { CalendarRange, CalendarOff, ChevronDown, Truck, XCircle } from 'lucide-react';
import type { Frete, FiltrosFrete } from '../../types';
import { presetEstaSemana, presetEsteMes, presetMesPassado } from '../../utils/dateRangePresets';

export type PresetKey = 'sem_chegada' | 'esta_semana' | 'este_mes' | 'mes_passado' | 'top_transportadora';

interface Props {
  fretes: Frete[];
  filtros: FiltrosFrete;
  /** Aplica o preset escolhido. Passa undefined p/ desativar. */
  onApplyPreset: (key: PresetKey | null, valor?: string) => void;
  presetAtivo: PresetKey | null;
  transportadoraTop?: string; // valor atual do dropdown top transportadora
}

/**
 * Retorna true se filtros[key] casa com o esperado do preset.
 */
function presetAtivoCheck(filtros: FiltrosFrete, key: PresetKey, hoje: Date = new Date()): boolean {
  if (key === 'sem_chegada') {
    // Preset 'sem chegada' não tem campo direto em FiltrosFrete; é
    // controlado externamente. Aqui retorna sempre false; o pai
    // gerencia `presetAtivo` explicitamente.
    return false;
  }
  if (key === 'esta_semana') {
    const r = presetEstaSemana(hoje);
    return filtros.dataInicio === r.dataInicio && filtros.dataFim === r.dataFim;
  }
  if (key === 'este_mes') {
    const r = presetEsteMes(hoje);
    return filtros.dataInicio === r.dataInicio && filtros.dataFim === r.dataFim;
  }
  if (key === 'mes_passado') {
    const r = presetMesPassado(hoje);
    return filtros.dataInicio === r.dataInicio && filtros.dataFim === r.dataFim;
  }
  return false;
}

export default function FretePresets({ fretes, filtros, onApplyPreset, presetAtivo, transportadoraTop }: Props) {
  // Top 5 transportadoras nos últimos 90 dias
  const top5 = useMemo<{ nome: string; count: number }[]>(() => {
    const hoje = new Date();
    const cutoff = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    const counts = new Map<string, number>();
    for (const f of fretes) {
      if (!f.transportadora || f.data < cutoffISO) continue;
      counts.set(f.transportadora, (counts.get(f.transportadora) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [fretes]);

  const semChegadaAtivo = presetAtivo === 'sem_chegada';
  const estaSemanaAtivo = presetAtivo === 'esta_semana' || (presetAtivo === null && presetAtivoCheck(filtros, 'esta_semana'));
  const esteMesAtivo = presetAtivo === 'este_mes' || (presetAtivo === null && presetAtivoCheck(filtros, 'este_mes'));
  const mesPassadoAtivo = presetAtivo === 'mes_passado' || (presetAtivo === null && presetAtivoCheck(filtros, 'mes_passado'));
  const topAtivo = presetAtivo === 'top_transportadora' && !!transportadoraTop;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold mr-1">Quick</span>

      <PresetChip
        active={semChegadaAtivo}
        onClick={() => onApplyPreset(semChegadaAtivo ? null : 'sem_chegada')}
        icon={<CalendarOff className="w-3 h-3" />}
        label="Sem chegada"
      />
      <PresetChip
        active={estaSemanaAtivo}
        onClick={() => onApplyPreset(estaSemanaAtivo ? null : 'esta_semana')}
        icon={<CalendarRange className="w-3 h-3" />}
        label="Esta semana"
      />
      <PresetChip
        active={esteMesAtivo}
        onClick={() => onApplyPreset(esteMesAtivo ? null : 'este_mes')}
        icon={<CalendarRange className="w-3 h-3" />}
        label="Este mês"
      />
      <PresetChip
        active={mesPassadoAtivo}
        onClick={() => onApplyPreset(mesPassadoAtivo ? null : 'mes_passado')}
        icon={<CalendarRange className="w-3 h-3" />}
        label="Mês passado"
      />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              topAtivo
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
                : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)]'
            }`}
          >
            <Truck className="w-3 h-3" />
            {topAtivo ? `Transp: ${transportadoraTop}` : 'Top transportadora'}
            <ChevronDown className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar transportadora…" />
            <CommandList>
              <CommandEmpty>Nenhuma encontrada.</CommandEmpty>
              <CommandGroup heading="Top 5 (últimos 90 dias)">
                {top5.map((t) => (
                  <CommandItem
                    key={t.nome}
                    value={t.nome}
                    onSelect={() => onApplyPreset('top_transportadora', t.nome)}
                  >
                    <span className="flex-1 truncate">{t.nome}</span>
                    <span className="text-[10px] text-[var(--color-fg-muted)] ml-2">{t.count}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {presetAtivo && (
        <button
          type="button"
          onClick={() => onApplyPreset(null)}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] transition-colors"
          title="Limpar preset"
        >
          <XCircle className="w-3 h-3" />
          Limpar preset
        </button>
      )}
    </div>
  );
}

function PresetChip({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[color:color-mix(in_srgb,var(--color-accent)_40%,transparent)]'
          : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
