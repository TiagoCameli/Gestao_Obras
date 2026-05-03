import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ChevronRight, Save } from 'lucide-react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useAuth } from '../../../contexts/AuthContext';
import { useEquipamentoComStatus } from '../hooks/useEquipamentoComStatus';
import { useManutencaoTarefa } from '../hooks/useManutencaoTarefa';
import { useTodasPecas } from '../hooks/useTodasPecas';
import { useTodosFluidos } from '../hooks/useTodosFluidos';
import { useMecanicosDisponiveis, type MecanicoDisponivel } from '../hooks/useMecanicosDisponiveis';
import CategoriaBadge from '../components/badges/CategoriaBadge';
import PrioridadeBadge from '../components/badges/PrioridadeBadge';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import ChecklistProcedimento from '../components/forms/ChecklistProcedimento';
import RecursosConsumidos, {
  type RecursoPecaUsada,
  type RecursoFluidoUsado,
} from '../components/forms/RecursosConsumidos';
import { pecasIniciais, fluidosIniciais } from '../components/forms/recursos-helpers';
import FotoUploader, { type FotoSelecionada } from '../components/forms/FotoUploader';
import {
  createRegistroComFotos,
  updateRegistro,
  uploadFotoRegistro,
} from '../utils/manutencaoRegistrosApi';
import { updateHorimetroAtual } from '../utils/equipamentosManutencaoApi';
import { supabase } from '../../../lib/supabase';
import {
  ACOES_MANUTENCAO,
  EXECUTOR_LABELS,
  type EquipamentoComStatusManutencao,
  type ExecutorPapel,
  type Fluido,
  type FluidoConsumo,
  type ManutencaoRegistro,
  type ManutencaoTarefa,
  type PecaConsumo,
  type Peca,
} from '../types';

type Etapa = 1 | 2 | 3 | 4;
type StatusRegistro = ManutencaoRegistro['status'];

function nowDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function localToIso(local: string): string {
  return new Date(local).toISOString();
}

const EXECUTOR_OPTS = (Object.keys(EXECUTOR_LABELS) as ExecutorPapel[]).map((k) => ({
  value: k,
  label: EXECUTOR_LABELS[k],
}));

const STATUS_OPTS: Array<{ value: StatusRegistro; label: string }> = [
  { value: 'concluida', label: 'Concluída' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'cancelada', label: 'Cancelada' },
];

// ─── Loader: resolve permissões + dados antes de montar o form ──────────────

export default function ExecutarManutencaoPage() {
  const { equipamentoId = '', tarefaId = '' } = useParams<{
    equipamentoId: string;
    tarefaId: string;
  }>();
  const [searchParams] = useSearchParams();
  const agendamentoId = searchParams.get('agendamento') ?? undefined;
  const { temAcao } = useAuth();
  const podeExecutar = temAcao(ACOES_MANUTENCAO.executar);

  const eq = useEquipamentoComStatus(equipamentoId);
  const tarefa = useManutencaoTarefa(tarefaId);
  const pecasCat = useTodasPecas();
  const fluidosCat = useTodosFluidos();
  const mecanicos = useMecanicosDisponiveis();

  if (!podeExecutar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para executar manutenção.
      </Card>
    );
  }

  if (eq.isLoading || tarefa.isLoading) return <ManutencaoLoadingState />;
  if (eq.error) return <ManutencaoErrorState erro={eq.error} onRetry={() => eq.refetch()} />;
  if (tarefa.error) {
    return <ManutencaoErrorState erro={tarefa.error} onRetry={() => tarefa.refetch()} />;
  }
  if (!eq.data) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Equipamento "{equipamentoId}" não encontrado.
      </Card>
    );
  }
  if (!tarefa.data) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Tarefa "{tarefaId}" não encontrada.
      </Card>
    );
  }

  return (
    <ExecutarManutencaoForm
      mode="criar"
      equipamentoId={equipamentoId}
      tarefaId={tarefaId}
      agendamentoId={agendamentoId}
      eq={eq.data}
      tarefa={tarefa.data}
      pecasCatalog={pecasCat.data ?? []}
      fluidosCatalog={fluidosCat.data ?? []}
      mecanicos={mecanicos.data ?? []}
    />
  );
}

// ─── Form: estado totalmente derivado das props (sem effects de init) ──────

export type ExecutarManutencaoMode = 'criar' | 'editar';

export interface ExecutarManutencaoFormProps {
  mode: ExecutarManutencaoMode;
  equipamentoId: string;
  tarefaId: string;
  agendamentoId?: string;
  eq: EquipamentoComStatusManutencao;
  tarefa: ManutencaoTarefa;
  pecasCatalog: Peca[];
  fluidosCatalog: Fluido[];
  mecanicos: MecanicoDisponivel[];
  /** Apenas em mode='editar': dados existentes do registro a editar. */
  initialRegistro?: ManutencaoRegistro;
}

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function ExecutarManutencaoForm({
  mode,
  equipamentoId,
  tarefaId,
  agendamentoId,
  eq,
  tarefa,
  pecasCatalog,
  fluidosCatalog,
  mecanicos,
  initialRegistro,
}: ExecutarManutencaoFormProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { usuario } = useAuth();

  const [etapa, setEtapa] = useState<Etapa>(1);

  const [executadoEm, setExecutadoEm] = useState<string>(() =>
    initialRegistro ? isoToLocal(initialRegistro.executadoEm) : nowDatetimeLocal()
  );
  const [horimetro, setHorimetro] = useState<string>(() => {
    if (initialRegistro?.horimetroNoMomento !== undefined) {
      return String(initialRegistro.horimetroNoMomento);
    }
    return eq.horimetroFuncional && eq.horimetroAtual !== undefined
      ? String(eq.horimetroAtual)
      : '';
  });
  const [executorPapel, setExecutorPapel] = useState<ExecutorPapel>(
    initialRegistro?.executorPapel ?? 'mecanico_propio'
  );
  const [funcionarioId, setFuncionarioId] = useState<string>(
    initialRegistro?.executadoPorFuncionarioId ?? ''
  );

  const [concluidos, setConcluidos] = useState<boolean[]>(() =>
    // Em modo editar, marca tudo como concluído (não temos histórico granular)
    initialRegistro
      ? new Array(tarefa.procedimento.length).fill(true)
      : new Array(tarefa.procedimento.length).fill(false)
  );

  const [pecas, setPecas] = useState<RecursoPecaUsada[]>(() =>
    initialRegistro
      ? pecasIniciais(initialRegistro.pecasUsadas)
      : pecasIniciais(tarefa.pecasNecessarias)
  );
  const [fluidos, setFluidos] = useState<RecursoFluidoUsado[]>(() =>
    initialRegistro
      ? fluidosIniciais(initialRegistro.fluidosUsados)
      : fluidosIniciais(tarefa.fluidosNecessarios)
  );
  const [fotos, setFotos] = useState<FotoSelecionada[]>([]);
  const [fotosExistentes, setFotosExistentes] = useState<string[]>(
    initialRegistro?.fotosUrls ?? []
  );

  const [status, setStatus] = useState<StatusRegistro>(initialRegistro?.status ?? 'concluida');
  const [observacoes, setObservacoes] = useState(initialRegistro?.observacoes ?? '');
  const [problemas, setProblemas] = useState(initialRegistro?.problemasEncontrados ?? '');
  const [recomendacoes, setRecomendacoes] = useState(initialRegistro?.acoesRecomendadas ?? '');
  const [custoEditado, setCustoEditado] = useState<string>(
    initialRegistro?.custoTotalBrl !== undefined ? String(initialRegistro.custoTotalBrl) : ''
  );
  const [custoTouched, setCustoTouched] = useState<boolean>(
    initialRegistro?.custoTotalBrl !== undefined
  );

  const [erro, setErro] = useState<string | null>(null);

  const custoCalculado = useMemo(() => {
    const pecaPorPN = new Map(pecasCatalog.map((p) => [p.partNumber, p]));
    const fluidoPorId = new Map(fluidosCatalog.map((f) => [f.id, f]));
    const totalPecas = pecas
      .filter((p) => p.usado)
      .reduce((acc, p) => {
        const cat = pecaPorPN.get(p.partNumber);
        return cat?.custoMedioBrl ? acc + cat.custoMedioBrl * p.quantity : acc;
      }, 0);
    const totalFluidos = fluidos
      .filter((f) => f.usado)
      .reduce((acc, f) => {
        const cat = fluidoPorId.get(f.fluidoId);
        return cat?.custoMedioLitroBrl ? acc + cat.custoMedioLitroBrl * f.quantityLiters : acc;
      }, 0);
    return Math.round((totalPecas + totalFluidos) * 100) / 100;
  }, [pecas, fluidos, pecasCatalog, fluidosCatalog]);

  const custoFinal = custoTouched ? Number(custoEditado) || 0 : custoCalculado;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!usuario) throw new Error('Sem usuário autenticado');

      const pecasUsadas: PecaConsumo[] = pecas
        .filter((p) => p.usado)
        .map((p) => ({ partNumber: p.partNumber, quantity: p.quantity, notes: p.notes }));
      const fluidosUsados: FluidoConsumo[] = fluidos
        .filter((f) => f.usado)
        .map((f) => ({
          fluidoId: f.fluidoId,
          quantityLiters: f.quantityLiters,
          notes: f.notes,
        }));

      const horimetroNum = horimetro.trim() === '' ? undefined : Number(horimetro);

      if (mode === 'criar') {
        const novo = await createRegistroComFotos(
          {
            equipamentoId,
            tarefaId,
            agendamentoId,
            executadoEm: localToIso(executadoEm),
            executorPapel,
            executadoPorFuncionarioId: funcionarioId || undefined,
            horimetroNoMomento: horimetroNum,
            status,
            pecasUsadas,
            fluidosUsados,
            custoTotalBrl: custoFinal || undefined,
            observacoes: observacoes.trim() || undefined,
            problemasEncontrados: problemas.trim() || undefined,
            acoesRecomendadas: recomendacoes.trim() || undefined,
            criadoPor: usuario.funcionarioId,
          },
          fotos.map((f) => f.file)
        );

        if (status === 'concluida' && horimetroNum !== undefined) {
          try {
            await updateHorimetroAtual(equipamentoId, horimetroNum, usuario.funcionarioId);
          } catch (e) {
            console.error('Falha ao atualizar horímetro:', e);
          }
        }
        return novo;
      }

      // mode === 'editar'
      if (!initialRegistro) throw new Error('Registro inicial ausente em modo editar');

      // Sobe fotos novas, anexa às existentes restantes
      const novasUrls: string[] = [];
      for (const f of fotos) {
        const url = await uploadFotoRegistro(f.file, initialRegistro.id);
        novasUrls.push(url);
      }
      const fotosUrlsFinais = [...fotosExistentes, ...novasUrls];

      // Identifica fotos REMOVIDAS (estavam no initialRegistro mas não em fotosExistentes)
      const removidas = (initialRegistro.fotosUrls ?? []).filter(
        (u) => !fotosExistentes.includes(u)
      );
      if (removidas.length > 0) {
        const paths: string[] = [];
        for (const url of removidas) {
          const m = url.match(/\/object\/sign\/[^/]+\/([^?]+)/);
          if (m) paths.push(decodeURIComponent(m[1]));
        }
        if (paths.length > 0) {
          try {
            await supabase.storage.from('manutencao-fotos').remove(paths);
          } catch (e) {
            console.warn('Falha ao remover fotos antigas do bucket:', e);
          }
        }
      }

      const atualizado = await updateRegistro(initialRegistro.id, {
        executadoEm: localToIso(executadoEm),
        executorPapel,
        executadoPorFuncionarioId: funcionarioId || undefined,
        horimetroNoMomento: horimetroNum,
        status,
        pecasUsadas,
        fluidosUsados,
        custoTotalBrl: custoFinal || undefined,
        observacoes: observacoes.trim() || undefined,
        problemasEncontrados: problemas.trim() || undefined,
        acoesRecomendadas: recomendacoes.trim() || undefined,
        fotosUrls: fotosUrlsFinais,
      });

      return atualizado;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      await qc.invalidateQueries({ queryKey: ['equipamentos'] });
      alert(mode === 'criar' ? 'Manutenção registrada.' : 'Registro atualizado.');
      navigate(`/manutencao/frota/${equipamentoId}`);
    },
    onError: (e) => {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (status === 'concluida') {
      const naoFeitos = concluidos.filter((c) => !c).length;
      if (naoFeitos > 0) {
        const mudar = confirm(
          `${naoFeitos} passo(s) não foram marcados como concluídos. Deseja salvar como "parcial" em vez de "concluída"?`
        );
        if (mudar) {
          setStatus('parcial');
          return;
        }
      }
    }

    salvar.mutate();
  }

  function proximaEtapa() {
    if (etapa < 4) setEtapa((etapa + 1) as Etapa);
  }
  function etapaAnterior() {
    if (etapa > 1) setEtapa((etapa - 1) as Etapa);
  }

  const TABS: Array<[Etapa, string]> = [
    [1, '1. Identificação'],
    [2, '2. Procedimento'],
    [3, '3. Recursos & fotos'],
    [4, '4. Finalização'],
  ];

  const passosTotal = tarefa.procedimento.length;
  const passosFeitos = concluidos.filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <nav
        aria-label="Breadcrumbs"
        className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1 flex-wrap"
      >
        <Link
          to="/manutencao/frota"
          className="hover:text-[var(--color-fg)] inline-flex items-center gap-1"
        >
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Frota
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link
          to={`/manutencao/frota/${equipamentoId}`}
          className="hover:text-[var(--color-fg)]"
        >
          {eq.patrimony}
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">Registrar manutenção</span>
      </nav>

      <Card className="!p-4">
        <h2 className="text-lg font-semibold text-[var(--color-fg)]">
          Registrando: {tarefa.titulo}
        </h2>
        <div className="mt-1 text-sm text-[var(--color-fg-muted)]">
          {eq.patrimony} · {eq.modeloNome ?? eq.nome}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          <CategoriaBadge categoria={tarefa.categoria} />
          <PrioridadeBadge prioridade={tarefa.prioridade} />
          {tarefa.duracaoEstimadaMin !== undefined && (
            <span className="text-xs text-[var(--color-fg-subtle)]">
              {tarefa.duracaoEstimadaMin} min estimados
            </span>
          )}
        </div>
      </Card>

      <nav
        aria-label="Etapas"
        className="flex border-b border-[var(--color-border)] overflow-x-auto"
      >
        {TABS.map(([n, label]) => (
          <button
            key={n}
            type="button"
            onClick={() => setEtapa(n)}
            aria-current={etapa === n ? 'page' : undefined}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ' +
              (etapa === n
                ? 'text-[var(--color-fg)] border-[var(--color-accent)]'
                : 'text-[var(--color-fg-muted)] border-transparent hover:text-[var(--color-fg)]')
            }
          >
            {label}
          </button>
        ))}
      </nav>

      {etapa === 1 && (
        <Card className="!p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Identificação
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              id="exec-data"
              label="Data e hora da execução"
              type="datetime-local"
              value={executadoEm}
              onChange={(e) => setExecutadoEm(e.target.value)}
              required
            />
            <Input
              id="exec-horimetro"
              label="Horímetro no momento (h)"
              type="number"
              step="0.1"
              min="0"
              value={horimetro}
              onChange={(e) => setHorimetro(e.target.value)}
              placeholder={
                eq.horimetroFuncional
                  ? 'Em branco se não medido'
                  : 'Equipamento sem horímetro'
              }
              disabled={!eq.horimetroFuncional}
            />
            <Select
              id="exec-papel"
              label="Papel do executor"
              options={EXECUTOR_OPTS}
              value={executorPapel}
              onChange={(e) => setExecutorPapel(e.target.value as ExecutorPapel)}
              required
            />
            <div>
              <label
                htmlFor="exec-funcionario"
                className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
              >
                Funcionário responsável
              </label>
              <select
                id="exec-funcionario"
                value={funcionarioId}
                onChange={(e) => setFuncionarioId(e.target.value)}
                className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)]"
              >
                <option value="">— não vinculado —</option>
                {mecanicos.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.funcao})
                  </option>
                ))}
              </select>
              {mecanicos.length === 0 && (
                <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                  Nenhum mecânico cadastrado em apont_funcionarios com função
                  MECÂNICO ou AUXILIAR DE MECÂNICO.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {etapa === 2 && (
        <Card className="!p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
            Procedimento
          </h3>
          <ChecklistProcedimento
            steps={tarefa.procedimento}
            concluidos={concluidos}
            onToggle={(i, v) =>
              setConcluidos((arr) => {
                const out = [...arr];
                out[i] = v;
                return out;
              })
            }
          />
        </Card>
      )}

      {etapa === 3 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="!p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
              Recursos consumidos
            </h3>
            <RecursosConsumidos
              pecas={pecas}
              fluidos={fluidos}
              pecasCatalog={pecasCatalog}
              fluidosCatalog={fluidosCatalog}
              onChangePecas={setPecas}
              onChangeFluidos={setFluidos}
            />
          </Card>
          <Card className="!p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-3">
              Fotos
            </h3>
            {mode === 'editar' && fotosExistentes.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
                  Fotos existentes ({fotosExistentes.length})
                </h4>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {fotosExistentes.map((url, i) => (
                    <div
                      key={url}
                      className="rounded-xl border border-[var(--color-border)] overflow-hidden relative aspect-square"
                    >
                      <img
                        src={url}
                        alt={`Foto existente ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          setFotosExistentes((arr) => arr.filter((_, j) => j !== i))
                        }
                        aria-label={`Remover foto existente ${i + 1}`}
                        className="!absolute top-1 right-1 !min-h-0 !px-1.5 !py-1"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-fg-subtle)] mt-2">
                  Fotos removidas serão deletadas do bucket ao salvar.
                </p>
              </div>
            )}
            <FotoUploader fotos={fotos} onChange={setFotos} />
          </Card>
        </div>
      )}

      {etapa === 4 && (
        <Card className="!p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
            Finalização
          </h3>

          <div className="grid sm:grid-cols-[200px_1fr] gap-3">
            <Select
              id="exec-status"
              label="Status"
              options={STATUS_OPTS}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusRegistro)}
              required
            />
            <Input
              id="exec-custo"
              label="Custo total (R$)"
              type="number"
              step="0.01"
              min="0"
              value={custoTouched ? custoEditado : String(custoCalculado)}
              onChange={(e) => {
                setCustoTouched(true);
                setCustoEditado(e.target.value);
              }}
            />
          </div>
          <p className="text-xs text-[var(--color-fg-subtle)]">
            Custo estimado pelos recursos consumidos: R${' '}
            {custoCalculado.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            {custoTouched && ' (editado manualmente)'}
          </p>

          <Textarea
            id="exec-obs"
            label="Observações"
            value={observacoes}
            onChange={setObservacoes}
            rows={3}
          />
          <Textarea
            id="exec-prob"
            label="Problemas encontrados"
            value={problemas}
            onChange={setProblemas}
            rows={3}
          />
          <Textarea
            id="exec-rec"
            label="Ações recomendadas"
            value={recomendacoes}
            onChange={setRecomendacoes}
            rows={3}
          />

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-sm">
            <h4 className="text-xs font-semibold uppercase text-[var(--color-fg-muted)] mb-2">
              Resumo
            </h4>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
              <dt className="text-[var(--color-fg-muted)]">Tarefa:</dt>
              <dd className="text-[var(--color-fg)]">{tarefa.titulo}</dd>
              <dt className="text-[var(--color-fg-muted)]">Equipamento:</dt>
              <dd className="text-[var(--color-fg)]">{eq.patrimony}</dd>
              <dt className="text-[var(--color-fg-muted)]">Data:</dt>
              <dd className="text-[var(--color-fg)]">
                {new Date(executadoEm).toLocaleString('pt-BR')}
              </dd>
              <dt className="text-[var(--color-fg-muted)]">Procedimento:</dt>
              <dd className="text-[var(--color-fg)]">
                {passosFeitos} de {passosTotal} passo(s) concluído(s)
              </dd>
              <dt className="text-[var(--color-fg-muted)]">Peças usadas:</dt>
              <dd className="text-[var(--color-fg)]">
                {pecas.filter((p) => p.usado).length}
              </dd>
              <dt className="text-[var(--color-fg-muted)]">Fluidos usados:</dt>
              <dd className="text-[var(--color-fg)]">
                {fluidos.filter((f) => f.usado).length}
              </dd>
              <dt className="text-[var(--color-fg-muted)]">Fotos:</dt>
              <dd className="text-[var(--color-fg)]">{fotos.length}</dd>
              <dt className="text-[var(--color-fg-muted)]">Status:</dt>
              <dd className="text-[var(--color-fg)] font-medium">{status}</dd>
            </dl>
          </div>

          {erro && (
            <div
              role="alert"
              className="text-sm px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/30"
            >
              {erro}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-between items-center sticky bottom-0 bg-[var(--color-surface-1)] border-t border-[var(--color-border)] py-3 px-1">
        <Button
          type="button"
          variant="secondary"
          onClick={etapaAnterior}
          disabled={etapa === 1 || salvar.isPending}
        >
          <ArrowLeft aria-hidden className="w-4 h-4" />
          Voltar
        </Button>

        {etapa < 4 ? (
          <Button type="button" variant="primary" onClick={proximaEtapa}>
            Próximo
            <ArrowRight aria-hidden className="w-4 h-4" />
          </Button>
        ) : (
          <Button type="submit" variant="primary" disabled={salvar.isPending}>
            <Save aria-hidden className="w-4 h-4" />
            {salvar.isPending ? 'Salvando...' : 'Salvar registro'}
          </Button>
        )}
      </div>
    </form>
  );
}

function Textarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
      />
    </div>
  );
}

export { ExecutarManutencaoPage };
