import { useMemo, useState } from 'react';
import { Eraser } from 'lucide-react';
import type { Deposito, Insumo } from '../../../types';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import AnexosBadge from '../../combustivel/AnexosBadge';
import TanqueVisual from './TanqueVisual';
import EsvaziarTanqueModal from './EsvaziarTanqueModal';

interface TanqueListProps {
  depositos: Deposito[];
  /** F11 — Mapa pra resolver combustivelAtualId → nome (cor depende do nome). */
  insumos: Insumo[];
  onEdit: (deposito: Deposito) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  onNovo: () => void;
  canCreate: boolean;
  /** F8.5.3 — click numa card (fora dos botões) abre drawer detalhes. */
  onSelect?: (d: Deposito) => void;
}

export default function TanqueList({
  depositos,
  insumos,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  onNovo,
  canCreate,
  onSelect,
}: TanqueListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [esvaziarTanque, setEsvaziarTanque] = useState<Deposito | null>(null);

  const insumoMap = useMemo(
    () => new Map(insumos.map((i) => [i.id, i.nome])),
    [insumos],
  );

  // F11 — Externos vão pra lista simples (sem visual). Próprios vão pro grid
  // com tanque horizontal renderizado.
  const { proprios, externos } = useMemo(() => {
    const sorted = [...depositos].sort((a, b) => a.nome.localeCompare(b.nome));
    return {
      proprios: sorted.filter((d) => !d.ehExterno),
      externos: sorted.filter((d) => d.ehExterno),
    };
  }, [depositos]);

  function combustivelNome(d: Deposito): string | null {
    if (!d.combustivelAtualId) return null;
    return insumoMap.get(d.combustivelAtualId) ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-200">
          Tanques de Combustível ({depositos.length})
        </h2>
        {canCreate && (
          <Button onClick={onNovo} className="text-sm">
            + Novo Tanque
          </Button>
        )}
      </div>

      {depositos.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          Nenhum tanque cadastrado.
        </div>
      ) : (
        <>
          {/* Próprios: visual horizontal */}
          {proprios.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {proprios.map((d) => {
                const cardClickable = !!onSelect;
                const cNome = combustivelNome(d);
                const podeEsvaziar = canEdit && d.nivelAtualLitros > 0;
                return (
                  <div
                    key={d.id}
                    className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 transition-colors ${
                      cardClickable ? 'cursor-pointer hover:border-emt-verde dark:hover:border-emt-verde' : ''
                    }`}
                    onClick={cardClickable ? () => onSelect!(d) : undefined}
                  >
                    <TanqueVisual
                      nome={d.nome}
                      apelido={d.apelido}
                      capacidadeLitros={d.capacidadeLitros}
                      nivelAtualLitros={d.nivelAtualLitros}
                      combustivelNome={cNome}
                      combustivelId={d.combustivelAtualId ?? null}
                    />

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-slate-700" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <AnexosBadge fotoUrls={d.fotoUrls} arquivoUrls={d.arquivoUrls} />
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${
                            d.ativo
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {d.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {podeEsvaziar && (
                          <button
                            type="button"
                            onClick={() => setEsvaziarTanque(d)}
                            className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                            title="Esvaziar tanque (descarte explícito para troca de combustível)"
                          >
                            <Eraser className="w-3.5 h-3.5" />
                            Esvaziar
                          </button>
                        )}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(d)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(d.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Externos: lista compacta — não tem visual porque sem controle de estoque */}
          {externos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Tanques externos (terceiros, sem controle de estoque)
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                {externos.map((d) => {
                  const rowClickable = !!onSelect;
                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between gap-3 px-4 py-3 ${
                        rowClickable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/40' : ''
                      }`}
                      onClick={rowClickable ? () => onSelect!(d) : undefined}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{d.nome}</p>
                        {d.apelido && (
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{d.apelido}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={(ev) => ev.stopPropagation()}>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-semibold">
                          Externo
                        </span>
                        <AnexosBadge fotoUrls={d.fotoUrls} arquivoUrls={d.arquivoUrls} />
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(d)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(d.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir Tanque"
        message="Tem certeza que deseja excluir este tanque? Esta ação não pode ser desfeita."
        onConfirm={() => {
          if (confirmDeleteId) onDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
        onClose={() => setConfirmDeleteId(null)}
      />

      <EsvaziarTanqueModal
        open={!!esvaziarTanque}
        onClose={() => setEsvaziarTanque(null)}
        tanque={esvaziarTanque}
        combustivelNome={esvaziarTanque ? combustivelNome(esvaziarTanque) : null}
      />
    </div>
  );
}
