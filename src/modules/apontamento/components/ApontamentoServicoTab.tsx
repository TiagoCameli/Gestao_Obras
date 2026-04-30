import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import {
  useEquipesApont,
  useFuncionarios,
  useObrasApont,
} from "../hooks/useApontamentoData";
import { listRegistrosDoDia, type RegistroPonto } from "../utils/pontoApi";
import {
  excluirLancamentoDoDia,
  listApontamentosDoDia,
  listServicosDaObra,
  type ApontamentoServico,
} from "../utils/apontamentoServicoApi";

import LancamentoModal from "./LancamentoServicoModal";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcula horas trabalhadas a partir das batidas aprovadas:
 *   (saida_almoco - entrada) + (saida_final - retorno_almoco)
 * Se não houver pausa, usa direto entrada → saida_final.
 * Se faltar saida_final, usa "agora" como referência (apenas para o dia de hoje).
 */
function calcHorasPonto(rs: RegistroPonto[]): number {
  const ok = rs.filter((r) => r.statusAprovacao !== "rejeitado");
  const get = (t: RegistroPonto["tipoBatida"]) =>
    ok.find((r) => r.tipoBatida === t);
  const entrada = get("entrada");
  if (!entrada) return 0;
  const saidaAlmoco = get("saida_almoco");
  const retorno = get("retorno_almoco");
  const saidaFinal = get("saida_final");

  const ms = (a?: RegistroPonto, b?: RegistroPonto) =>
    a && b ? new Date(b.hora).getTime() - new Date(a.hora).getTime() : 0;

  if (saidaAlmoco && retorno && saidaFinal) {
    return (ms(entrada, saidaAlmoco) + ms(retorno, saidaFinal)) / 3_600_000;
  }
  if (saidaFinal) {
    return ms(entrada, saidaFinal) / 3_600_000;
  }
  // dia em andamento: usa "agora" como saída provisória
  const agora = new Date();
  const fim = new Date(agora.toISOString());
  return (
    (fim.getTime() - new Date(entrada.hora).getTime()) / 3_600_000
  );
}

export default function ApontamentoServicoTab() {
  const qc = useQueryClient();
  const { data: obras = [] } = useObrasApont();
  const [obraId, setObraId] = useState<string>("");
  const { data: equipes = [] } = useEquipesApont(obraId || undefined);
  const [equipeId, setEquipeId] = useState<string>("");
  const [data, setData] = useState<string>(hojeIso());

  const { data: funcionarios = [] } = useFuncionarios();
  const funcsDaEquipe = useMemo(
    () =>
      funcionarios.filter(
        (f) => f.equipeId === equipeId && f.status === "ativo"
      ),
    [funcionarios, equipeId]
  );
  const funcIds = funcsDaEquipe.map((f) => f.id);

  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-contrato", obraId] as const,
    queryFn: () => listServicosDaObra(obraId),
    enabled: !!obraId,
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["apont", "registros", equipeId, data] as const,
    queryFn: () => listRegistrosDoDia(equipeId, data),
    enabled: !!equipeId && !!data,
  });

  const apontKey = ["apont", "apontamentos-servico", equipeId, data] as const;
  const { data: apontamentos = [] } = useQuery({
    queryKey: apontKey,
    queryFn: () => listApontamentosDoDia(funcIds, data),
    enabled: !!equipeId && !!data && funcIds.length > 0,
  });

  // Funcionários que tiveram pelo menos uma batida no dia (não rejeitada)
  const horasPorFunc = useMemo(() => {
    const m: Record<string, number> = {};
    funcsDaEquipe.forEach((f) => {
      const rs = registros.filter((r) => r.funcionarioId === f.id);
      m[f.id] = calcHorasPonto(rs);
    });
    return m;
  }, [funcsDaEquipe, registros]);

  const apropriadasPorFunc = useMemo(() => {
    const m: Record<string, number> = {};
    apontamentos.forEach((a) => {
      m[a.funcionarioId] = (m[a.funcionarioId] ?? 0) + a.horas;
    });
    return m;
  }, [apontamentos]);

  const funcsComPonto = useMemo(
    () => funcsDaEquipe.filter((f) => (horasPorFunc[f.id] ?? 0) > 0),
    [funcsDaEquipe, horasPorFunc]
  );

  // Seleção
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  function toggleSel(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selecionados.size === funcsComPonto.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(funcsComPonto.map((f) => f.id)));
    }
  }

  // Modal de lançamento (1 lançamento por pessoa por dia, com N linhas)
  const [modal, setModal] = useState<{
    open: boolean;
    funcionarioIds: string[];
    iniciais: ApontamentoServico[]; // linhas pré-existentes (edit)
  }>({ open: false, funcionarioIds: [], iniciais: [] });

  // Excluir lançamento inteiro do dia
  const [excluindoFuncId, setExcluindoFuncId] = useState<string | null>(null);

  // agrupa lançamentos por funcionário pra histórico e edição
  const lancamentosPorFunc = useMemo(() => {
    const m: Record<string, ApontamentoServico[]> = {};
    apontamentos.forEach((a) => {
      (m[a.funcionarioId] ??= []).push(a);
    });
    return m;
  }, [apontamentos]);

  function abrirLancamento(funcIds: string[]) {
    if (funcIds.length === 1) {
      const ja = lancamentosPorFunc[funcIds[0]] ?? [];
      setModal({ open: true, funcionarioIds: funcIds, iniciais: ja });
    } else {
      // bulk: ignora pré-existentes (substitui todo mundo pelo novo conjunto)
      setModal({ open: true, funcionarioIds: funcIds, iniciais: [] });
    }
  }

  const servicoNome = useMemo(
    () =>
      Object.fromEntries(
        servicos.map((s) => [
          s.id,
          s.codigo ? `${s.codigo} — ${s.nome}` : s.nome,
        ])
      ),
    [servicos]
  );
  const funcNome = useMemo(
    () => Object.fromEntries(funcsDaEquipe.map((f) => [f.id, f.nome])),
    [funcsDaEquipe]
  );

  if (obras.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-[var(--color-fg-subtle)]">
        Cadastre obras no módulo Medição antes de apropriar serviços.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Obra"
          options={obras.map((o) => ({ value: o.id, label: o.nome }))}
          value={obraId}
          onChange={(e) => {
            setObraId(e.target.value);
            setEquipeId("");
            setSelecionados(new Set());
          }}
        />
        <Select
          label="Equipe"
          options={equipes.map((eq) => ({ value: eq.id, label: eq.nome }))}
          value={equipeId}
          onChange={(e) => {
            setEquipeId(e.target.value);
            setSelecionados(new Set());
          }}
          disabled={!obraId}
        />
        <Input
          label="Data"
          type="date"
          value={data}
          onChange={(e) => {
            setData(e.target.value);
            setSelecionados(new Set());
          }}
        />
      </div>

      {!equipeId ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Selecione obra e equipe.
        </p>
      ) : funcsComPonto.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Nenhum funcionário desta equipe tem ponto registrado em {data}.
        </p>
      ) : (
        <>
          {/* Tabela de funcionários do dia */}
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                <tr className="text-left">
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selecionados.size === funcsComPonto.length &&
                        funcsComPonto.length > 0
                      }
                      onChange={toggleAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Funcionário</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ponto</th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Apropriado
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right">
                    Pendente
                  </th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {funcsComPonto.map((f) => {
                  const horasPonto = horasPorFunc[f.id] ?? 0;
                  const horasApr = apropriadasPorFunc[f.id] ?? 0;
                  const pendente = +(horasPonto - horasApr).toFixed(2);
                  const status: "ok" | "pendente" | "excedido" =
                    horasApr > horasPonto + 0.001
                      ? "excedido"
                      : pendente > 0.05
                      ? "pendente"
                      : "ok";
                  return (
                    <tr
                      key={f.id}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/40"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selecionados.has(f.id)}
                          onChange={() => toggleSel(f.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{f.nome}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {horasPonto.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {horasApr.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {pendente > 0 ? `${pendente.toFixed(2)}h` : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => abrirLancamento([f.id])}
                          className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent)]"
                        >
                          {(lancamentosPorFunc[f.id]?.length ?? 0) > 0
                            ? "Editar"
                            : "+ Lançar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selecionados.size > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => abrirLancamento([...selecionados])}>
                Lançar serviço para {selecionados.size}{" "}
                {selecionados.size === 1 ? "selecionado" : "selecionados"}
              </Button>
            </div>
          )}

          {/* Histórico do dia (1 lançamento por pessoa, várias linhas) */}
          <section className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
              Lançamentos do dia
            </h3>
            {Object.keys(lancamentosPorFunc).length === 0 ? (
              <p className="text-sm text-[var(--color-fg-subtle)] italic">
                Nenhum lançamento ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(lancamentosPorFunc).map(([fid, linhas]) => {
                  const total = linhas.reduce((acc, l) => acc + l.horas, 0);
                  return (
                    <div
                      key={fid}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3"
                    >
                      <header className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-medium text-[var(--color-fg)]">
                            {funcNome[fid] ?? "—"}
                          </div>
                          <div className="text-xs text-[var(--color-fg-subtle)]">
                            {linhas.length}{" "}
                            {linhas.length === 1 ? "linha" : "linhas"} · total{" "}
                            <span className="font-mono">
                              {total.toFixed(2)}h
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => abrirLancamento([fid])}
                            className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-accent)]"
                          >
                            ✎ Editar
                          </button>
                          <button
                            onClick={() => setExcluindoFuncId(fid)}
                            className="text-xs px-2 py-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
                          >
                            ✕ Excluir
                          </button>
                        </div>
                      </header>
                      <ul className="divide-y divide-[var(--color-border)] text-sm">
                        {linhas.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-2 py-1.5"
                          >
                            <span
                              className={
                                "px-1.5 py-0.5 rounded text-[10px] font-medium " +
                                (l.tipo === "produtivo"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300")
                              }
                            >
                              {l.tipo}
                            </span>
                            <span className="text-[var(--color-fg-muted)] truncate">
                              {l.tipo === "improdutivo"
                                ? l.motivoImprodutivo ?? "—"
                                : l.servicoId
                                ? servicoNome[l.servicoId] ?? "—"
                                : "—"}
                            </span>
                            <span className="ml-auto font-mono text-xs text-[var(--color-fg-muted)]">
                              {l.horas.toFixed(2)}h
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <LancamentoModal
        open={modal.open}
        funcionarioIds={modal.funcionarioIds}
        funcNome={funcNome}
        servicos={servicos}
        iniciais={modal.iniciais}
        data={data}
        horasPorFunc={horasPorFunc}
        onClose={() =>
          setModal({ open: false, funcionarioIds: [], iniciais: [] })
        }
        onSaved={() => {
          qc.invalidateQueries({ queryKey: apontKey });
          setSelecionados(new Set());
          setModal({ open: false, funcionarioIds: [], iniciais: [] });
        }}
      />

      <ConfirmDialog
        open={excluindoFuncId !== null}
        onClose={() => setExcluindoFuncId(null)}
        onConfirm={async () => {
          if (excluindoFuncId)
            await excluirLancamentoDoDia(excluindoFuncId, data);
          qc.invalidateQueries({ queryKey: apontKey });
          setExcluindoFuncId(null);
        }}
        title="Excluir lançamento do dia"
        message={
          excluindoFuncId
            ? `Excluir todas as linhas lançadas para ${
                funcNome[excluindoFuncId] ?? "este funcionário"
              } em ${data}?`
            : ""
        }
      />
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "ok" | "pendente" | "excedido";
}) {
  const map = {
    ok: { label: "✅ completo", cls: "bg-emerald-500/15 text-emerald-400" },
    pendente: { label: "⚠️ pendente", cls: "bg-amber-500/15 text-amber-400" },
    excedido: { label: "❌ excedido", cls: "bg-rose-500/15 text-rose-400" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

