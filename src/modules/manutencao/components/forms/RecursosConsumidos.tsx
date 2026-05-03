import { useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import Input from '../../../../components/ui/Input';
import type { Peca, Fluido } from '../../types';

export interface RecursoPecaUsada {
  partNumber: string;
  quantity: number;
  usado: boolean;
  /** true se foi adicionada como extra (não estava no plano da tarefa). */
  extra?: boolean;
  notes?: string;
}

export interface RecursoFluidoUsado {
  fluidoId: string;
  quantityLiters: number;
  usado: boolean;
  extra?: boolean;
  notes?: string;
}

export interface RecursosConsumidosProps {
  pecas: RecursoPecaUsada[];
  fluidos: RecursoFluidoUsado[];
  pecasCatalog: Peca[];
  fluidosCatalog: Fluido[];
  onChangePecas: (pecas: RecursoPecaUsada[]) => void;
  onChangeFluidos: (fluidos: RecursoFluidoUsado[]) => void;
  className?: string;
}

export function RecursosConsumidos({
  pecas,
  fluidos,
  pecasCatalog,
  fluidosCatalog,
  onChangePecas,
  onChangeFluidos,
  className = '',
}: RecursosConsumidosProps) {
  const [addPecaOpen, setAddPecaOpen] = useState(false);
  const [addFluidoOpen, setAddFluidoOpen] = useState(false);

  const pecaPorPN = new Map(pecasCatalog.map((p) => [p.partNumber, p]));
  const fluidoPorId = new Map(fluidosCatalog.map((f) => [f.id, f]));

  function setPecaUsado(i: number, usado: boolean) {
    onChangePecas(pecas.map((p, j) => (j === i ? { ...p, usado } : p)));
  }
  function setPecaQty(i: number, q: number) {
    onChangePecas(pecas.map((p, j) => (j === i ? { ...p, quantity: q } : p)));
  }
  function removePeca(i: number) {
    onChangePecas(pecas.filter((_, j) => j !== i));
  }
  function setFluidoUsado(i: number, usado: boolean) {
    onChangeFluidos(fluidos.map((f, j) => (j === i ? { ...f, usado } : f)));
  }
  function setFluidoQty(i: number, q: number) {
    onChangeFluidos(
      fluidos.map((f, j) => (j === i ? { ...f, quantityLiters: q } : f))
    );
  }
  function removeFluido(i: number) {
    onChangeFluidos(fluidos.filter((_, j) => j !== i));
  }

  return (
    <div className={'flex flex-col gap-5 ' + className}>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Peças
          </h4>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setAddPecaOpen(true)}
          >
            <Plus aria-hidden className="w-3.5 h-3.5" />
            Adicionar peça extra
          </Button>
        </div>
        {pecas.length === 0 ? (
          <p className="text-sm italic text-[var(--color-fg-subtle)]">
            Nenhuma peça planejada nem extra.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pecas.map((p, i) => {
              const cat = pecaPorPN.get(p.partNumber);
              return (
                <li
                  key={p.partNumber + i}
                  className={
                    'flex items-center gap-3 px-3 py-2 rounded-lg border ' +
                    (p.usado
                      ? 'border-[var(--color-border)] bg-[var(--color-surface-1)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)]/50 opacity-70')
                  }
                >
                  <input
                    type="checkbox"
                    checked={p.usado}
                    onChange={(e) => setPecaUsado(i, e.target.checked)}
                    aria-label={`Marcar peça ${p.partNumber} como usada`}
                    className="w-4 h-4 accent-[var(--color-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-[var(--color-fg)]">
                        {p.partNumber}
                      </span>
                      {!cat && (
                        <AlertTriangle
                          aria-label="Peça não cadastrada no catálogo"
                          className="w-3.5 h-3.5 text-[var(--color-warning-fg)]"
                        />
                      )}
                      {p.extra && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-info-soft)] text-[var(--color-info-fg)]">
                          extra
                        </span>
                      )}
                    </div>
                    {cat && (
                      <div className="text-xs text-[var(--color-fg-muted)] truncate">
                        {cat.description}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={p.quantity}
                    onChange={(e) => setPecaQty(i, Number(e.target.value))}
                    disabled={!p.usado}
                    className="w-20 h-9 text-right rounded-lg px-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
                    aria-label="Quantidade real"
                  />
                  <span className="text-xs text-[var(--color-fg-subtle)] w-6">un.</span>
                  {p.extra && (
                    <button
                      type="button"
                      onClick={() => removePeca(i)}
                      aria-label="Remover peça"
                      className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger-fg)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Fluidos
          </h4>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setAddFluidoOpen(true)}
          >
            <Plus aria-hidden className="w-3.5 h-3.5" />
            Adicionar fluido extra
          </Button>
        </div>
        {fluidos.length === 0 ? (
          <p className="text-sm italic text-[var(--color-fg-subtle)]">
            Nenhum fluido planejado nem extra.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {fluidos.map((f, i) => {
              const cat = fluidoPorId.get(f.fluidoId);
              const nome = cat?.catProductName ?? cat?.description ?? null;
              return (
                <li
                  key={f.fluidoId + i}
                  className={
                    'flex items-center gap-3 px-3 py-2 rounded-lg border ' +
                    (f.usado
                      ? 'border-[var(--color-border)] bg-[var(--color-surface-1)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)]/50 opacity-70')
                  }
                >
                  <input
                    type="checkbox"
                    checked={f.usado}
                    onChange={(e) => setFluidoUsado(i, e.target.checked)}
                    aria-label={`Marcar fluido ${f.fluidoId} como usado`}
                    className="w-4 h-4 accent-[var(--color-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      {nome ? (
                        <span className="text-[var(--color-fg)]">{nome}</span>
                      ) : (
                        <span className="font-mono text-[var(--color-fg-muted)] inline-flex items-center gap-1.5">
                          {f.fluidoId}
                          <AlertTriangle
                            aria-label="Fluido não cadastrado no catálogo"
                            className="w-3.5 h-3.5 text-[var(--color-warning-fg)]"
                          />
                        </span>
                      )}
                      {f.extra && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--color-info-soft)] text-[var(--color-info-fg)]">
                          extra
                        </span>
                      )}
                    </div>
                    {cat?.viscosity && (
                      <div className="text-xs text-[var(--color-fg-muted)]">
                        {cat.viscosity}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={f.quantityLiters}
                    onChange={(e) => setFluidoQty(i, Number(e.target.value))}
                    disabled={!f.usado}
                    className="w-20 h-9 text-right rounded-lg px-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
                    aria-label="Litros reais"
                  />
                  <span className="text-xs text-[var(--color-fg-subtle)] w-6">L</span>
                  {f.extra && (
                    <button
                      type="button"
                      onClick={() => removeFluido(i)}
                      aria-label="Remover fluido"
                      className="text-[var(--color-fg-subtle)] hover:text-[var(--color-danger-fg)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Modal
        open={addPecaOpen}
        onClose={() => setAddPecaOpen(false)}
        title="Adicionar peça extra"
      >
        <SeletorCatalogo
          itens={pecasCatalog.map((p) => ({
            id: p.partNumber,
            label: p.partNumber,
            sub: p.description,
          }))}
          jaUsados={new Set(pecas.map((p) => p.partNumber))}
          quantidadeLabel="Qtd"
          quantidadeStep="1"
          onCancel={() => setAddPecaOpen(false)}
          onConfirm={(id, qty) => {
            onChangePecas([
              ...pecas,
              { partNumber: id, quantity: qty, usado: true, extra: true },
            ]);
            setAddPecaOpen(false);
          }}
        />
      </Modal>

      <Modal
        open={addFluidoOpen}
        onClose={() => setAddFluidoOpen(false)}
        title="Adicionar fluido extra"
      >
        <SeletorCatalogo
          itens={fluidosCatalog.map((f) => ({
            id: f.id,
            label: f.catProductName ?? f.description,
            sub: f.viscosity,
          }))}
          jaUsados={new Set(fluidos.map((f) => f.fluidoId))}
          quantidadeLabel="Litros"
          quantidadeStep="0.1"
          onCancel={() => setAddFluidoOpen(false)}
          onConfirm={(id, qty) => {
            onChangeFluidos([
              ...fluidos,
              { fluidoId: id, quantityLiters: qty, usado: true, extra: true },
            ]);
            setAddFluidoOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

interface SeletorCatalogoProps {
  itens: Array<{ id: string; label: string; sub?: string }>;
  jaUsados: Set<string>;
  quantidadeLabel: string;
  quantidadeStep: string;
  onCancel: () => void;
  onConfirm: (id: string, qty: number) => void;
}

function SeletorCatalogo({
  itens,
  jaUsados,
  quantidadeLabel,
  quantidadeStep,
  onCancel,
  onConfirm,
}: SeletorCatalogoProps) {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string>('');
  const [qty, setQty] = useState<string>('1');

  const filtrados = busca.trim()
    ? itens.filter(
        (i) =>
          i.id.toLowerCase().includes(busca.toLowerCase()) ||
          i.label.toLowerCase().includes(busca.toLowerCase()) ||
          (i.sub ?? '').toLowerCase().includes(busca.toLowerCase())
      )
    : itens;

  return (
    <div className="p-4 sm:p-5 flex flex-col gap-3">
      <Input
        id="seletor-busca"
        label="Buscar"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="ID, descrição..."
      />
      <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--color-border)]">
        {filtrados.length === 0 ? (
          <p className="text-sm italic text-[var(--color-fg-subtle)] p-3">
            Nenhum item encontrado.
          </p>
        ) : (
          <ul>
            {filtrados.map((i) => {
              const ja = jaUsados.has(i.id);
              const sel = selecionado === i.id;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => !ja && setSelecionado(i.id)}
                    disabled={ja}
                    className={
                      'w-full text-left px-3 py-2 border-b border-[var(--color-border)] last:border-b-0 ' +
                      (sel
                        ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]'
                        : ja
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-[var(--color-surface-2)]')
                    }
                  >
                    <div className="text-sm font-medium">{i.label}</div>
                    {i.sub && (
                      <div className="text-xs text-[var(--color-fg-muted)] truncate">
                        {i.sub}
                      </div>
                    )}
                    {ja && (
                      <div className="text-xs text-[var(--color-fg-subtle)] italic">
                        já adicionado
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Input
        id="seletor-qty"
        label={quantidadeLabel}
        type="number"
        step={quantidadeStep}
        min="0"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!selecionado || !Number.isFinite(Number(qty)) || Number(qty) <= 0}
          onClick={() => onConfirm(selecionado, Number(qty))}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}

export default RecursosConsumidos;
