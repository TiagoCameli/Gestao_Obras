import { useState } from 'react';
import type { Deposito } from '../../../types';
import Button from '../../ui/Button';
import Input from '../../ui/Input';

interface TanqueFormProps {
  initial?: Deposito | null;
  onSubmit: (deposito: Deposito) => Promise<void>;
  onCancel: () => void;
}

export default function TanqueForm({ initial, onSubmit, onCancel }: TanqueFormProps) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [capacidadeLitros, setCapacidadeLitros] = useState(initial?.capacidadeLitros?.toString() ?? '');
  const [nivelAtualLitros, setNivelAtualLitros] = useState(initial?.nivelAtualLitros?.toString() ?? '0');
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !capacidadeLitros) return;
    setSalvando(true);
    try {
      await onSubmit({
        id: initial?.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        nome: nome.trim(),
        capacidadeLitros: parseFloat(capacidadeLitros) || 0,
        nivelAtualLitros: parseFloat(nivelAtualLitros) || 0,
        ativo,
        criadoPor: initial?.criadoPor ?? '',
        ehExterno: initial?.ehExterno ?? false,
        transportadoraProprietariaId: initial?.transportadoraProprietariaId ?? null,
        apelido: initial?.apelido ?? null,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do Tanque"
          id="tanque-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          placeholder="Ex: Tanque Principal"
        />
        <Input
          label="Capacidade (Litros)"
          id="tanque-capacidade"
          type="number"
          min="0"
          step="0.01"
          value={capacidadeLitros}
          onChange={(e) => setCapacidadeLitros(e.target.value)}
          required
        />
        {!initial && (
          <Input
            label="Nível Atual (Litros)"
            id="tanque-nivel"
            type="number"
            min="0"
            step="0.01"
            value={nivelAtualLitros}
            onChange={(e) => setNivelAtualLitros(e.target.value)}
          />
        )}
      </div>

      {initial && (
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="rounded border-gray-300 dark:border-slate-600"
          />
          Tanque ativo
        </label>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={salvando || !nome.trim() || !capacidadeLitros}>
          {salvando ? 'Salvando...' : initial ? 'Salvar' : 'Criar Tanque'}
        </Button>
      </div>
    </form>
  );
}
