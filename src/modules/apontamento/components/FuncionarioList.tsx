import { useEffect, useMemo, useState } from "react";
import type { Funcionario, StatusFuncionario } from "../types/funcionario";
import { formatarCpf } from "../types/funcionario";
import { getFotoUrls } from "../utils/apontamentoApi";
import { useEquipesApont, useObrasApont } from "../hooks/useApontamentoData";
import SmartSelect from "../../../components/ui/SmartSelect";

interface Props {
  funcionarios: Funcionario[];
  onEdit: (f: Funcionario) => void;
  onDelete: (id: string) => void;
}

const STATUS_OPTS: { value: StatusFuncionario | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "afastado", label: "Afastado" },
  { value: "demitido", label: "Demitido" },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export default function FuncionarioList({
  funcionarios,
  onEdit,
  onDelete,
}: Props) {
  const { data: obras = [] } = useObrasApont();
  const { data: equipes = [] } = useEquipesApont();

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroFuncao, setFiltroFuncao] = useState("");
  const [filtroCpf, setFiltroCpf] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusFuncionario | "">("");

  const funcionariosFiltrados = useMemo(() => {
    const nq = normalize(filtroNome.trim());
    const fq = normalize(filtroFuncao.trim());
    const cpfDigits = filtroCpf.replace(/\D/g, "");
    return funcionarios.filter((f) => {
      if (nq && !normalize(f.nome).includes(nq)) return false;
      if (fq && !normalize(f.funcao).includes(fq)) return false;
      if (cpfDigits && !(f.cpf ?? "").replace(/\D/g, "").includes(cpfDigits)) return false;
      if (filtroStatus && f.status !== filtroStatus) return false;
      return true;
    });
  }, [funcionarios, filtroNome, filtroFuncao, filtroCpf, filtroStatus]);

  const filtroAtivo =
    !!filtroNome.trim() || !!filtroFuncao.trim() || !!filtroCpf.replace(/\D/g, "") || !!filtroStatus;
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
    <div className="space-y-3">
      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <FilterField label="Nome">
          <input
            type="text"
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            placeholder="Buscar nome..."
            className={inputCls}
          />
        </FilterField>
        <FilterField label="Função">
          <input
            type="text"
            value={filtroFuncao}
            onChange={(e) => setFiltroFuncao(e.target.value)}
            placeholder="Ex: motorista, encarregado..."
            className={inputCls}
          />
        </FilterField>
        <FilterField label="CPF">
          <input
            type="text"
            value={filtroCpf}
            onChange={(e) => setFiltroCpf(e.target.value)}
            placeholder="000.000.000-00"
            className={inputCls}
            inputMode="numeric"
          />
        </FilterField>
        <FilterField label="Status">
          <SmartSelect
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusFuncionario | "")}
            className={inputCls + ' text-left flex items-center'}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </SmartSelect>
        </FilterField>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-fg-subtle)]">
        <span>
          {funcionariosFiltrados.length} de {funcionarios.length}{" "}
          {funcionarios.length === 1 ? "funcionário" : "funcionários"}
        </span>
        {filtroAtivo && (
          <button
            type="button"
            onClick={() => {
              setFiltroNome("");
              setFiltroFuncao("");
              setFiltroCpf("");
              setFiltroStatus("");
            }}
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline underline-offset-2"
          >
            Limpar filtros
          </button>
        )}
      </div>

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
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {funcionariosFiltrados.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--color-fg-muted)]">
                Nenhum funcionário corresponde aos filtros aplicados.
              </td>
            </tr>
          ) : funcionariosFiltrados.map((f) => (
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
                ) : f.equipeId ? (
                  // Funcionário alocado a uma equipe sem obra atribuída.
                  <>
                    <div>{equipeNome[f.equipeId] ?? "—"}</div>
                    <div className="text-[var(--color-fg-subtle)]">sem obra</div>
                  </>
                ) : (
                  <span className="text-amber-400">sem alocação</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={f.status} />
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
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg px-3 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] " +
  "border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] " +
  "focus:ring-2 focus:ring-[var(--color-ring)]";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
        {label}
      </label>
      {children}
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
