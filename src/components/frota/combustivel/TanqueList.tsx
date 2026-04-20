import { useMemo } from 'react';
import type { Deposito, Obra } from '../../../types';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { useState } from 'react';

interface TanqueListProps {
  depositos: Deposito[];
  obras: Obra[];
  onEdit: (deposito: Deposito) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  onNovo: () => void;
  canCreate: boolean;
}

export default function TanqueList({
  depositos,
  obras,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  onNovo,
  canCreate,
}: TanqueListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const obrasMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of obras) map.set(o.id, o.nome);
    return map;
  }, [obras]);

  const tanquesOrdenados = useMemo(
    () => [...depositos].sort((a, b) => a.nome.localeCompare(b.nome)),
    [depositos]
  );

  function getNivelPercent(d: Deposito) {
    if (!d.capacidadeLitros) return 0;
    return Math.min(100, (d.nivelAtualLitros / d.capacidadeLitros) * 100);
  }

  function getNivelColor(pct: number) {
    if (pct > 50) return 'bg-green-500';
    if (pct > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  return (
    <div className="space-y-4">
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

      {tanquesOrdenados.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">
          Nenhum tanque cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tanquesOrdenados.map((d) => {
            const pct = getNivelPercent(d);
            return (
              <div
                key={d.id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow p-4 border border-gray-100 dark:border-slate-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-slate-200">{d.nome}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {obrasMap.get(d.obraId) || '—'}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      d.ativo
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {d.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                    <span>{d.nivelAtualLitros.toLocaleString('pt-BR')} L</span>
                    <span>{d.capacidadeLitros.toLocaleString('pt-BR')} L</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${getNivelColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 text-right">
                    {pct.toFixed(1)}%
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  {canEdit && (
                    <button
                      onClick={() => onEdit(d)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
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
    </div>
  );
}
