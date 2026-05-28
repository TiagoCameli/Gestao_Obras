import { History, Plus, Save } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Switch } from '@/components/shadcn/switch';

interface CalculoToolbarProps {
  alertaAtivo: boolean;
  onToggleAlerta: (novo: boolean) => void;
  onSalvar: () => void;
  onAbrirHistorico: () => void;
  onAdicionarLinha: () => void;
  desabilitado: boolean;
  salvando: boolean;
  podeVerHistorico: boolean;
}

/**
 * Barra de ações do canvas de cálculo: switch de verificação automática,
 * adicionar linha, salvar (Cmd+S) e histórico (gated por `podeVerHistorico`).
 * Em modo somente leitura (`desabilitado`) o switch reflete o estado atual mas
 * fica desabilitado.
 */
export function CalculoToolbar({
  alertaAtivo,
  onToggleAlerta,
  onSalvar,
  onAbrirHistorico,
  onAdicionarLinha,
  desabilitado,
  salvando,
  podeVerHistorico,
}: CalculoToolbarProps) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2">
      <div
        className="flex items-center gap-2"
        title="Liga ou desliga a comparação RHS vs LHS. O parser continua resolvendo `=` vazio."
      >
        <Switch
          id="verificacao-switch"
          checked={alertaAtivo}
          onCheckedChange={onToggleAlerta}
          disabled={desabilitado}
        />
        <label htmlFor="verificacao-switch" className="text-sm text-foreground">
          Verificação automática
        </label>
      </div>

      <div className="flex-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdicionarLinha}
        disabled={desabilitado}
      >
        <Plus />
        Adicionar linha
      </Button>

      <Button
        type="button"
        variant="default"
        size="sm"
        title="Salvar (Cmd+S)"
        onClick={onSalvar}
        disabled={desabilitado || salvando}
      >
        <Save />
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>

      {podeVerHistorico && (
        <Button type="button" variant="ghost" size="sm" onClick={onAbrirHistorico}>
          <History />
          Histórico
        </Button>
      )}
    </div>
  );
}
