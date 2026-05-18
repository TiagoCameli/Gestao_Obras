/**
 * InsumoSelect — Combobox de seleção de insumo com busca por texto e
 * opção de cadastro rápido quando o material não está cadastrado.
 *
 * Comportamento:
 *  - Mostra dropdown filtrável com todos os insumos cadastrados.
 *  - Usuário pode digitar para filtrar; lista mostra correspondências em tempo real.
 *  - Se a busca não tem correspondência exata, aparece a opção
 *    "+ Cadastrar novo insumo: '<texto>'" no rodapé.
 *  - Click no item da lista → dispara onChange com insumoId, descricao, unidade, categoria.
 *  - Click em "Cadastrar novo" → dispara onCreateNew com o texto digitado.
 *  - Permite também salvar como texto livre (tab/blur com texto não vinculado).
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { Insumo } from '../../types';

interface InsumoSelectProps {
  insumos: Insumo[];
  insumoId?: string;
  descricao: string;
  onChange: (patch: {
    insumoId?: string;
    descricao: string;
    unidade?: string;
    categoria?: string;
  }) => void;
  onCreateNew: (queryInicial: string) => void;
  /** Filtra por tipo de insumo (ex: 'material', 'combustivel'). Padrão: todos. */
  tipoInsumo?: string;
  placeholder?: string;
  /** Estilo compacto (h-7, padding menor) para uso em células de tabela. */
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}

export default function InsumoSelect({
  insumos,
  insumoId,
  descricao,
  onChange,
  onCreateNew,
  tipoInsumo,
  placeholder = 'Buscar ou digitar…',
  compact = false,
  disabled = false,
  id,
}: InsumoSelectProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 0,
  });

  const insumosAtivos = useMemo(() => {
    return insumos
      .filter((i) => i.ativo !== false)
      .filter((i) => !tipoInsumo || i.tipo === tipoInsumo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [insumos, tipoInsumo]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return insumosAtivos;
    return insumosAtivos.filter((i) => i.nome.toLowerCase().includes(q));
  }, [insumosAtivos, busca]);

  // Match exato (ignora case + acentos)
  const exactMatch = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return null;
    return insumosAtivos.find((i) => i.nome.toLowerCase() === q) ?? null;
  }, [insumosAtivos, busca]);

  // Texto exibido no botão fechado: nome do insumo vinculado OU descrição livre
  const insumoVinculado = insumoId
    ? insumos.find((i) => i.id === insumoId)
    : undefined;
  const textoVisivel = insumoVinculado?.nome || descricao || '';

  // Fecha ao clicar fora (considera tanto o botão quanto o popup no portal)
  useEffect(() => {
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      const insidePopup = !!document
        .querySelector('[data-insumo-select-popup="true"]')
        ?.contains(target);
      const insideWrap = wrapRef.current?.contains(target);
      if (!insidePopup && !insideWrap) {
        if (open && busca && busca !== textoVisivel) {
          onChange({ insumoId: undefined, descricao: busca });
        }
        setOpen(false);
        setBusca('');
        setHi(0);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busca, textoVisivel]);

  // Reposiciona o popup quando abre / em scroll / em resize
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    function reposicionar() {
      const rect = btnRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 280),
      });
    }
    reposicionar();
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || hi < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  function selecionar(ins: Insumo) {
    onChange({
      insumoId: ins.id,
      descricao: ins.nome,
      unidade: ins.unidade,
      categoria: ins.categoria,
    });
    setOpen(false);
    setBusca('');
    setHi(0);
  }

  function abrirParaTipoLivre() {
    if (!busca.trim()) return;
    onChange({ insumoId: undefined, descricao: busca.trim() });
    setOpen(false);
    setBusca('');
  }

  function abrirCadastro() {
    onCreateNew(busca.trim() || descricao || '');
    setOpen(false);
    setBusca('');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (e.key === 'Escape') {
      // Não deixa o Escape borbulhar pro modal — fecha só o popup
      if (open) {
        e.preventDefault();
        e.stopPropagation();
      }
      setOpen(false);
      setBusca('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const maxIdx = filtered.length + (exactMatch ? 0 : busca.trim() ? 1 : 0) - 1;
      setHi((i) => Math.min(i + 1, maxIdx));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hi >= 0 && hi < filtered.length) {
        selecionar(filtered[hi]);
      } else if (hi === filtered.length && busca.trim() && !exactMatch) {
        // Posição do botão "Cadastrar novo"
        abrirCadastro();
      } else if (busca.trim()) {
        abrirParaTipoLivre();
      }
    } else if (e.key === 'Tab' && busca.trim() && !insumoId) {
      abrirParaTipoLivre();
    }
  }

  const btnClassBase = compact
    ? 'w-full px-2.5 py-1.5 text-sm text-left rounded-md border border-transparent bg-transparent hover:bg-[var(--color-surface-2)] focus:outline-none focus:bg-[var(--color-surface-1)] focus:border-[var(--color-border-strong)] flex items-center justify-between gap-2 min-h-[32px]'
    : 'w-full h-[42px] px-3 py-2 text-sm text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center justify-between gap-2';

  const semTexto = !textoVisivel;
  const mostrarCadastrar = busca.trim().length > 0 && !exactMatch;

  return (
    <div ref={wrapRef} className="relative w-full" onKeyDown={handleKeyDown}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={btnClassBase + (disabled ? ' opacity-60 cursor-not-allowed' : ' cursor-pointer')}
      >
        <span className={`truncate ${semTexto ? 'text-[var(--color-fg-subtle)]' : 'text-[var(--color-fg)]'}`}>
          {textoVisivel || placeholder}
        </span>
        {!compact && (
          <svg className="w-4 h-4 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && !disabled && createPortal(
        <div
          data-insumo-select-popup="true"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[200] bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg,0_8px_24px_rgba(0,0,0,0.18))] overflow-hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite para filtrar..."
              value={busca}
              onChange={(e) => { setBusca(e.target.value); setHi(0); }}
              className="w-full h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2 text-sm focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 && !mostrarCadastrar && (
              <li className="px-3 py-2 text-sm text-[var(--color-fg-subtle)] italic">
                Nenhum insumo cadastrado encontrado
              </li>
            )}
            {filtered.map((ins, idx) => (
              <li
                key={ins.id}
                role="option"
                aria-selected={ins.id === insumoId}
                data-idx={idx}
                className={
                  'px-3 py-2 text-sm mx-1 rounded-md cursor-pointer flex items-center justify-between gap-2 ' +
                  (idx === hi ? 'bg-[var(--color-surface-2)] ' : 'hover:bg-[var(--color-surface-2)] ') +
                  (ins.id === insumoId ? 'text-[var(--color-accent-fg)] font-medium' : 'text-[var(--color-fg)]')
                }
                onMouseDown={(e) => { e.preventDefault(); selecionar(ins); }}
                onMouseEnter={() => setHi(idx)}
              >
                <span className="truncate">{ins.nome}</span>
                <span className="text-[10.5px] text-[var(--color-fg-subtle)] shrink-0 uppercase tracking-wide">
                  {ins.unidade}
                </span>
              </li>
            ))}
            {mostrarCadastrar && (
              <li
                role="option"
                aria-selected={false}
                data-idx={filtered.length}
                className={
                  'mx-1 mt-1 px-3 py-2 text-sm rounded-md cursor-pointer border-t border-[var(--color-border)] flex items-center gap-2 ' +
                  (hi === filtered.length ? 'bg-[var(--color-accent)]/15 ' : 'hover:bg-[var(--color-accent)]/10 ') +
                  'text-[var(--color-accent-fg,var(--color-accent))] font-medium'
                }
                onMouseDown={(e) => { e.preventDefault(); abrirCadastro(); }}
                onMouseEnter={() => setHi(filtered.length)}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="truncate">
                  Cadastrar novo insumo: <strong>"{busca.trim()}"</strong>
                </span>
              </li>
            )}
          </ul>
          {busca.trim() && !exactMatch && filtered.length > 0 && (
            <div className="px-3 py-1.5 text-[10.5px] text-[var(--color-fg-subtle)] border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40">
              Pressione <kbd className="px-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]">Tab</kbd> para usar
              <span className="font-medium"> "{busca.trim()}"</span> como descrição livre.
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
