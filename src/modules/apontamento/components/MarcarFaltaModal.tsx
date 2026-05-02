import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import { criarAusencia, TIPO_AUSENCIA_LABEL, type TipoAusencia } from "../utils/ausenciaApi";
import type { Funcionario } from "../types/funcionario";

interface Props {
  open: boolean;
  funcionario: Funcionario | null;
  /** Data sugerida (do filtro de Registro de Ponto) — pode ser editada. */
  dataSugerida: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function MarcarFaltaModal({
  open, funcionario, dataSugerida, onClose, onSaved,
}: Props) {
  const qc = useQueryClient();
  const [dataInicio, setDataInicio] = useState(dataSugerida);
  const [dataFim, setDataFim] = useState(dataSugerida);
  const [tipo, setTipo] = useState<TipoAusencia>("falta_injustificada");
  const [observacao, setObservacao] = useState("");

  const mut = useMutation({
    mutationFn: () => {
      if (!funcionario) throw new Error("Sem funcionário");
      return criarAusencia({
        funcionarioId: funcionario.id,
        dataInicio,
        dataFim,
        tipo,
        observacao: observacao.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apont", "ausencias"] });
      onSaved?.();
      onClose();
      // Reseta para próxima abertura
      setObservacao("");
      setTipo("falta_injustificada");
    },
  });

  if (!funcionario) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Marcar falta — ${funcionario.nome}`}
      size="default"
    >
      <form
        onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
        className="space-y-3"
      >
        <Select
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoAusencia)}
          options={(Object.keys(TIPO_AUSENCIA_LABEL) as TipoAusencia[]).map((t) => ({
            value: t,
            label: TIPO_AUSENCIA_LABEL[t],
          }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="De"
            type="date"
            value={dataInicio}
            onChange={(e) => {
              const v = e.target.value;
              setDataInicio(v);
              if (dataFim < v) setDataFim(v);
            }}
            required
          />
          <Input
            label="Até"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observação <span className="text-[var(--color-fg-subtle)]">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo, contexto..."
            className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
          />
        </div>
        {mut.error && (
          <div className="text-xs text-[var(--color-danger)]">
            {(mut.error as Error).message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Salvando..." : "Marcar falta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
