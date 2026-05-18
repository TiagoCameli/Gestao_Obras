/**
 * PrazoEntregaInput — Campo especializado para prazo de entrega.
 *
 * O usuário digita só a quantidade de dias e escolhe a unidade
 * ("dias úteis", "dias corridos", etc.). O valor é montado automaticamente
 * como "5 dias úteis" e gravado no formulário.
 *
 * Aceita o valor de volta como string completa — faz parsing para preencher
 * número + unidade na edição.
 */
import { useMemo, useState, useEffect } from 'react';
import SmartSelect from './SmartSelect';

interface PrazoEntregaInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}

const UNIDADES: { value: string; label: string }[] = [
  { value: 'dias úteis', label: 'dias úteis' },
  { value: 'dias corridos', label: 'dias corridos' },
  { value: 'dias', label: 'dias' },
  { value: 'semanas', label: 'semanas' },
  { value: 'meses', label: 'meses' },
  { value: 'imediato', label: 'imediato (pronta entrega)' },
];

const DEFAULT_UNIDADE = 'dias úteis';

/** Tenta extrair número + unidade de um texto livre tipo "5 dias úteis". */
function parseInicial(raw: string): { numero: string; unidade: string } {
  if (!raw) return { numero: '', unidade: DEFAULT_UNIDADE };
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.includes('imediato') || trimmed.includes('pronta entrega')) {
    return { numero: '', unidade: 'imediato' };
  }
  const match = raw.match(/^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return { numero: '', unidade: DEFAULT_UNIDADE };
  const numero = match[1];
  const resto = match[2].trim().toLowerCase();
  // Tenta casar com uma das unidades conhecidas
  const candidato = UNIDADES.find((u) =>
    u.value !== 'imediato' && resto.startsWith(u.value),
  );
  return { numero, unidade: candidato?.value ?? DEFAULT_UNIDADE };
}

function montarTexto(numero: string, unidade: string): string {
  if (unidade === 'imediato') return 'Imediato (pronta entrega)';
  if (!numero.trim()) return '';
  return `${numero.trim()} ${unidade}`;
}

export default function PrazoEntregaInput({
  value,
  onChange,
  disabled,
  id,
}: PrazoEntregaInputProps) {
  // Estado interno: número + unidade. Sincroniza com value externo.
  const inicial = useMemo(() => parseInicial(value), [value]);
  const [numero, setNumero] = useState(inicial.numero);
  const [unidade, setUnidade] = useState(inicial.unidade);

  // Se o value externo mudar (ex: load de form), sincroniza
  useEffect(() => {
    const reparse = parseInicial(value);
    setNumero(reparse.numero);
    setUnidade(reparse.unidade);
  }, [value]);

  function commitNumero(n: string) {
    setNumero(n);
    onChange(montarTexto(n, unidade));
  }

  function commitUnidade(u: string) {
    setUnidade(u);
    onChange(montarTexto(numero, u));
  }

  const isImediato = unidade === 'imediato';

  return (
    <div className="flex gap-2 items-stretch">
      <input
        id={id}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={isImediato ? '' : numero}
        onChange={(e) => commitNumero(e.target.value)}
        disabled={disabled || isImediato}
        placeholder={isImediato ? '—' : 'Ex.: 5'}
        className="w-24 h-[42px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
      />
      <SmartSelect
        value={unidade}
        onChange={(e) => commitUnidade(e.target.value)}
        disabled={disabled}
        wrapperClassName="relative flex-1"
        className="w-full h-[42px] rounded-lg px-3 py-2 text-sm text-left bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center"
      >
        {UNIDADES.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </SmartSelect>
    </div>
  );
}
