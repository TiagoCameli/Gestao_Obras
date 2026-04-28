import { useEffect, useMemo, useState } from "react";
import type { Funcionario } from "../types/funcionario";
import { formatarCpf } from "../types/funcionario";
import { getFotoUrls } from "../utils/apontamentoApi";
import { useEquipesApont, useObrasApont } from "../hooks/useApontamentoData";

interface Props {
  funcionarios: Funcionario[];
  onEdit: (f: Funcionario) => void;
  onDelete: (id: string) => void;
}

export default function FuncionarioList({
  funcionarios,
  onEdit,
  onDelete,
}: Props) {
  const { data: obras = [] } = useObrasApont();
  const { data: equipes = [] } = useEquipesApont();
  const obraNome = useMemo(
    () => Object.fromEntries(obras.map((o) => [o.id, o.nome])),
    [obras]
  );
  const equipeNome = useMemo(
    () => Object.fromEntries(equipes.map((eq) => [eq.id, eq.nome])),
    [equipes]
  );

  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const paths = funcionarios.map((f) => f.fotoPerfil).filter(Boolean) as string[];
    if (paths.length === 0) return;
    let alive = true;
    getFotoUrls(paths).then((map) => {
      if (alive) setThumbs(map);
    });
    return () => {
      alive = false;
    };
  }, [funcionarios]);

  if (funcionarios.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-fg-subtle)] text-sm">
        Nenhum funcionário cadastrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
          <tr className="text-left">
            <th className="px-4 py-3 font-medium">Funcionário</th>
            <th className="px-4 py-3 font-medium">CPF</th>
            <th className="px-4 py-3 font-medium">Função</th>
            <th className="px-4 py-3 font-medium">Vínculo</th>
            <th className="px-4 py-3 font-medium">Obra / Equipe</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">HE</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {funcionarios.map((f) => (
            <tr
              key={f.id}
              className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {f.fotoPerfil && thumbs[f.fotoPerfil] ? (
                    <img
                      src={thumbs[f.fotoPerfil]}
                      alt={f.nome}
                      className="w-9 h-9 rounded-full object-cover border border-[var(--color-border)]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-fg-subtle)]">
                      {f.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium text-[var(--color-fg)]">
                    {f.nome}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--color-fg-muted)] font-mono text-xs">
                {formatarCpf(f.cpf)}
              </td>
              <td className="px-4 py-3 capitalize">{f.funcao}</td>
              <td className="px-4 py-3">{f.tipoVinculo}</td>
              <td className="px-4 py-3 text-[var(--color-fg-muted)] text-xs">
                {f.obraId ? (
                  <>
                    <div>{obraNome[f.obraId] ?? "—"}</div>
                    <div className="text-[var(--color-fg-subtle)]">
                      {f.equipeId ? equipeNome[f.equipeId] : "sem equipe"}
                    </div>
                  </>
                ) : (
                  <span className="text-amber-400">sem alocação</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={f.status} />
              </td>
              <td className="px-4 py-3">
                {f.permiteHorasExtras ? (
                  <span className="text-xs text-emerald-500">✓</span>
                ) : (
                  <span className="text-xs text-[var(--color-fg-subtle)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => onEdit(f)}
                  className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(f.id)}
                  className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-danger)] ml-1"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: Funcionario["status"] }) {
  const map: Record<Funcionario["status"], string> = {
    ativo: "bg-emerald-500/15 text-emerald-400",
    inativo: "bg-zinc-500/20 text-zinc-400",
    afastado: "bg-amber-500/15 text-amber-400",
    demitido: "bg-rose-500/15 text-rose-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status]}`}
    >
      {status}
    </span>
  );
}
