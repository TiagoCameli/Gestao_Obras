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
import { listRegistrosDoDia, listRegistrosPontoRange, type RegistroPonto } from "../utils/pontoApi";
import {
  excluirLancamentoDoDia,
  listApontamentosDoDia,
  listApontamentosServicoRange,
  listServicosDaObra,
  listTodosServicos,
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
  const { data: equipes = [] } = useEquipesApont(undefined);
  const [equipeId, setEquipeId] = useState<string>("");
  const [data, setData] = useState<string>(hojeIso());

  const { data: funcionarios = [] } = useFuncionarios();
  // Quando nada está filtrado, lista todos os ativos. Com obra → filtra
  // por obra direta; com equipe → filtra pela equipe (mantém o fluxo
  // original de seleção em massa por equipe).
  const funcsDaEquipe = useMemo(() => {
    let list = funcionarios.filter((f) => f.status === "ativo");
    if (equipeId) list = list.filter((f) => f.equipeId === equipeId);
    else if (obraId) list = list.filter((f) => f.obraId === obraId);
    return list;
  }, [funcionarios, equipeId, obraId]);
  const funcIds = funcsDaEquipe.map((f) => f.id);

  const { data: servicos = [] } = useQuery({
    queryKey: ["apont", "servicos-contrato", obraId || "all"] as const,
    queryFn: () => (obraId ? listServicosDaObra(obraId) : listTodosServicos()),
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["apont", "registros", obraId, equipeId, data] as const,
    queryFn: () =>
      equipeId
        ? listRegistrosDoDia(equipeId, data)
        : listRegistrosPontoRange({
            dataInicio: data,
            dataFim: data,
            obraId: obraId || undefined,
          }),
    enabled: !!data,
  });

  const apontKey = ["apont", "apontamentos-servico", obraId, equipeId, data] as const;
  const { data: apontamentos = [] } = useQuery({
    queryKey: apontKey,
    queryFn: () =>
      equipeId
        ? listApontamentosDoDia(funcIds, data)
        : listApontamentosServicoRange({
            dataInicio: data,
            dataFim: data,
            obraId: obraId || undefined,
          }),
    enabled: !!data,
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

      {/* B1.3 — Botão Exportar Excel da visão do dia */}
      {funcsComPonto.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={async () => {
              const ExcelJS = (await import('exceljs')).default;
              const wb = new ExcelJS.Workbook();
              wb.creator = 'EMT Construtora';
              wb.created = new Date();
              const ws = wb.addWorksheet(`Apontamento ${data}`);
              ws.columns = [
                { header: 'Funcionário', key: 'nome', width: 32 },
                { header: 'CPF', key: 'cpf', width: 16 },
                { header: 'Ponto (h)', key: 'ponto', width: 12 },
                { header: 'Apropriado (h)', key: 'apropriado', width: 14 },
                { header: 'Pendente (h)', key: 'pendente', width: 12 },
                { header: 'Status', key: 'status', width: 12 },
              ];
              for (const f of funcsComPonto) {
                const horasPonto = horasPorFunc[f.id] ?? 0;
                const horasApr = apropriadasPorFunc[f.id] ?? 0;
                const pendente = +(horasPonto - horasApr).toFixed(2);
                const status =
                  horasApr > horasPonto + 0.001 ? 'Excedido' : pendente > 0.05 ? 'Pendente' : 'OK';
                ws.addRow({
                  nome: f.nome,
                  cpf: f.cpf ?? '',
                  ponto: Number(horasPonto.toFixed(2)),
                  apropriado: Number(horasApr.toFixed(2)),
                  pendente: pendente > 0 ? Number(pendente.toFixed(2)) : 0,
                  status,
                });
              }
              ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
              ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
              ws.getRow(1).height = 22;
              ws.views = [{ state: 'frozen', ySplit: 1 }];
              const buffer = await wb.xlsx.writeBuffer();
              const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `apontamento_servico_${data}.xlsx`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar Excel
          </button>
        </div>
      )}

      {funcsComPonto.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-fg-subtle)]">
          Nenhum funcionário {equipeId ? "desta equipe" : obraId ? "desta obra" : ""} tem ponto registrado em {data}.
        </p>
      ) : (
        <>
          {/* MW2 — Cards de progresso para mobile (< sm), tabela densa em telas maiores */}
          <div className="sm:hidden space-y-2">
            {/* Header de seleção em mobile */}
            <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)]">
              <label className="flex items-center gap-2 text-xs text-[var(--color-fg-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selecionados.size === funcsComPonto.length && funcsComPonto.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4"
                />
                <span>Selecionar todos ({funcsComPonto.length})</span>
              </label>
            </div>
            {funcsComPonto.map((f) => {
              const horasPonto = horasPorFunc[f.id] ?? 0;
              const horasApr = apropriadasPorFunc[f.id] ?? 0;
              const pendente = +(horasPonto - horasApr).toFixed(2);
              const status: "ok" | "pendente" | "excedido" =
                horasApr > horasPonto + 0.001 ? "excedido" : pendente > 0.05 ? "pendente" : "ok";
              const pct = horasPonto > 0 ? Math.min(100, (horasApr / horasPonto) * 100) : 0;
              const barCor =
                status === "ok"
                  ? "bg-[var(--color-success)]"
                  : status === "excedido"
                  ? "bg-[var(--color-danger)]"
                  : "bg-[var(--color-warning)]";
              // Avatar com iniciais
              const iniciais = f.nome
                .trim()
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <article
                  key={`m-${f.id}`}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selecionados.has(f.id)}
                      onChange={() => toggleSel(f.id)}
                      className="w-4 h-4 mt-1.5 shrink-0"
                    />
                    <div className="w-10 h-10 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] inline-flex items-center justify-center text-xs font-semibold shrink-0">
                      {iniciais || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-[var(--color-fg)] truncate">
                          {f.nome}
                        </p>
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-[11px] text-[var(--color-fg-muted)] mb-1.5 font-mono">
                        {horasApr.toFixed(1)}h / {horasPonto.toFixed(1)}h
                        {pendente > 0.05 && (
                          <span className="text-[var(--color-warning-fg)] ml-1.5">
                            (faltam {pendente.toFixed(1)}h)
                          </span>
                        )}
                      </div>
                      {/* Barra de progresso */}
                      <div className="h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden mb-2">
                        <div
                          className={`h-full ${barCor} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <button
                        onClick={() => abrirLancamento([f.id])}
                        className="w-full text-sm font-medium py-2 rounded-lg bg-[var(--color-accent)] text-white hover:brightness-110 transition-all"
                      >
                        {(lancamentosPorFunc[f.id]?.length ?? 0) > 0
                          ? "Editar apontamento"
                          : "Apontar serviço"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Tabela de funcionários do dia (visível >= sm).
              min-w garante scroll horizontal real em tablets/desktop. */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[560px] text-sm">
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
                  <th className="px-3 py-2.5 font-medium text-right hidden sm:table-cell">
                    Apropriado
                  </th>
                  <th className="px-3 py-2.5 font-medium text-right hidden sm:table-cell">
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
                      <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">
                        {horasApr.toFixed(2)}h
                      </td>
                      <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">
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
        requirePassword={false}
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

