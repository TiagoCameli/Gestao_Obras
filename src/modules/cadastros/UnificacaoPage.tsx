import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import {
  useSugestoesUnificacao,
  useVincularColaboradorFuncionario,
  useDesvincularColaborador,
  usePreviewBackfill,
  useAplicarBackfill,
  useAplicarBackfillLote,
  type ParUnificacaoSugerido,
} from '../../hooks/useUnificacao';
import { useColaboradores } from '../../hooks/useColaboradores';

/**
 * Tela /cadastros/unificacao — Fase 1 da unificação Colaborador × Funcionário.
 *
 * O que faz:
 * - Lê pares sugeridos (RPC colaborador_match_funcionario_sugestoes).
 * - Mostra cada par lado-a-lado para revisão manual.
 * - Botão "Vincular" só cria a FK colaboradores.funcionario_id.
 *   Não copia dados nem apaga registros.
 *
 * O que NÃO faz:
 * - Não migra dados (isso é a Fase 2).
 * - Não consolida nem apaga tabelas (isso é a Fase 3).
 */
export default function UnificacaoPage() {
  const { data: sugestoes = [], isLoading, error } = useSugestoesUnificacao();
  const vincular = useVincularColaboradorFuncionario();

  // Pares "pulados" nesta sessão (não persiste — só esconde da lista).
  const [pulados, setPulados] = useState<Set<string>>(new Set());
  const chave = (p: ParUnificacaoSugerido) => `${p.colaboradorId}::${p.funcionarioId}`;

  // Estatísticas (para o cabeçalho).
  const { data: colaboradores = [] } = useColaboradores();
  const totalColab = colaboradores.length;
  const vinculados = colaboradores.filter((c) => c.apontFuncionarioId).length;
  const semSugestao = useMemo(() => {
    const idsComSugestao = new Set(sugestoes.map((s) => s.colaboradorId));
    return colaboradores.filter((c) => !c.apontFuncionarioId && !idsComSugestao.has(c.id)).length;
  }, [colaboradores, sugestoes]);

  const visiveis = sugestoes.filter((s) => !pulados.has(chave(s)));

  const handleVincular = async (par: ParUnificacaoSugerido) => {
    await vincular.mutateAsync({
      colaboradorId: par.colaboradorId,
      funcionarioId: par.funcionarioId,
    });
  };

  const handlePular = (par: ParUnificacaoSugerido) => {
    setPulados((prev) => new Set(prev).add(chave(par)));
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] mb-3">
        <Link to="/cadastros" className="hover:text-[var(--color-fg)] transition-colors">
          Cadastros
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">Unificação Colaborador × Funcionário (Apontamento RH)</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Unificar Colaboradores e Funcionários do Apontamento RH
        </h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-2xl">
          O sistema sugere pares de pessoas que provavelmente são as mesmas em <b>Colaboradores</b> e em
          <b> Funcionários do Apontamento RH</b>. Revise cada par e clique em <b>Vincular</b> para confirmar.
          Esta ação cria apenas uma referência cruzada — nada é apagado nem copiado nesta fase.
        </p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Colaboradores" value={totalColab} />
        <Stat label="Sugestões pendentes" value={sugestoes.length} />
        <Stat label="Já vinculados" value={vinculados} accent="success" />
        <Stat label="Sem sugestão de par" value={semSugestao} accent="muted" />
      </div>

      {/* Estado de carregamento / erro */}
      {isLoading && (
        <div className="p-12 text-center text-sm text-[var(--color-fg-muted)] bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl">
          Carregando sugestões...
        </div>
      )}

      {error && (
        <div className="p-6 text-sm text-[var(--color-danger)] bg-[var(--color-danger-soft)] border border-[var(--color-danger)] rounded-xl">
          Erro ao carregar sugestões. A função SQL <code>colaborador_match_apont_funcionario_sugestoes</code> está
          aplicada no banco? Veja a migration <code>20260513201000_marco5_pr28b_unificacao_fix_apont_funcionarios.sql</code>.
        </div>
      )}

      {!isLoading && !error && visiveis.length === 0 && (
        <div className="p-12 text-center bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhuma sugestão pendente. {pulados.size > 0 ? `Você pulou ${pulados.size} nesta sessão.` : ''}
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Os {semSugestao} colaboradores sem sugestão precisam ser revisados manualmente (sem par óbvio em
            Funcionários do Apontamento RH).
          </p>
        </div>
      )}

      {/* Lista de pares */}
      <div className="space-y-3">
        {visiveis.map((par) => (
          <ParCard
            key={chave(par)}
            par={par}
            onVincular={() => handleVincular(par)}
            onPular={() => handlePular(par)}
            loading={vincular.isPending}
          />
        ))}
      </div>

      {/* Pares já vinculados (Fase 2 — backfill) */}
      <ParesVinculadosSection />
    </div>
  );
}

/**
 * Seção da Fase 2: lista colaboradores já vinculados e oferece o botão
 * "Mesclar dados" que abre o modal de preview do backfill.
 */
function ParesVinculadosSection() {
  const { data: colaboradores = [] } = useColaboradores();
  const desvincular = useDesvincularColaborador();
  const aplicarLote = useAplicarBackfillLote();
  const vinculados = colaboradores.filter((c) => c.apontFuncionarioId);

  const [backfillColabId, setBackfillColabId] = useState<string | null>(null);
  const [loteResultado, setLoteResultado] = useState<{ total: number; pares: number } | null>(null);

  const handleMesclarTodos = async () => {
    const ids = vinculados.map((c) => c.id);
    const r = await aplicarLote.mutateAsync(ids);
    setLoteResultado({ total: r.totalCampos, pares: r.paresProcessados });
  };

  if (vinculados.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight mb-1">Pares vinculados</h2>
          <p className="text-xs text-[var(--color-fg-muted)] max-w-2xl">
            Para cada par confirmado, você pode <b>Mesclar dados</b> — copia CPF, RG, Telefone e Data de
            nascimento do Colaborador para o Funcionário do Apontamento RH. Nunca sobrescreve valores já
            preenchidos.
          </p>
        </div>
        <Button onClick={handleMesclarTodos} disabled={aplicarLote.isPending}>
          {aplicarLote.isPending
            ? `Mesclando… (${vinculados.length})`
            : `Mesclar todos (${vinculados.length})`}
        </Button>
      </div>

      {loteResultado && (
        <div className="mb-3 p-3 rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success-fg)] text-sm">
          <b>{loteResultado.total}</b> campos preenchidos em <b>{loteResultado.pares}</b> pares.
          <button
            type="button"
            onClick={() => setLoteResultado(null)}
            className="ml-3 underline text-xs"
          >
            ok
          </button>
        </div>
      )}

      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider">Colaborador</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider">CPF</th>
              <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {vinculados.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2.5 text-[var(--color-fg)]">{c.nome}</td>
                <td className="px-4 py-2.5 text-[var(--color-fg-muted)] tabular-nums">{c.cpf || '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="secondary" onClick={() => setBackfillColabId(c.id)}>
                    Mesclar dados
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => desvincular.mutateAsync(c.id)}
                    disabled={desvincular.isPending}
                    className="ml-2"
                  >
                    Desvincular
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {backfillColabId && (
        <BackfillModal
          colaboradorId={backfillColabId}
          onClose={() => setBackfillColabId(null)}
        />
      )}
    </section>
  );
}

/**
 * Modal de preview + apply do backfill para um par vinculado.
 */
function BackfillModal({ colaboradorId, onClose }: { colaboradorId: string; onClose: () => void }) {
  const { data: linhas = [], isLoading } = usePreviewBackfill(colaboradorId);
  const aplicar = useAplicarBackfill();
  const [resultado, setResultado] = useState<{ campos: number; detalhe: string } | null>(null);

  const naoVaiCopiar = linhas.filter((l) => !l.vaiPreencher);
  const vaiCopiar = linhas.filter((l) => l.vaiPreencher);

  const handleAplicar = async () => {
    const r = await aplicar.mutateAsync(colaboradorId);
    setResultado({ campos: r.camposPreenchidos, detalhe: r.detalhe });
  };

  return (
    <Modal open onClose={onClose} title="Mesclar dados — Colaborador → Apontamento RH" size="lg">
      {isLoading && <p className="text-sm text-[var(--color-fg-muted)]">Carregando preview…</p>}

      {!isLoading && resultado === null && (
        <>
          <p className="text-sm text-[var(--color-fg-muted)] mb-4">
            Os campos abaixo serão {vaiCopiar.length === 0 ? '(nada a copiar)' : `copiados (${vaiCopiar.length})`}.
            Valores já preenchidos no Apontamento RH permanecem intactos.
          </p>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-[var(--color-fg-muted)] text-xs uppercase tracking-wider">
                <th className="text-left px-3 py-1.5">Campo</th>
                <th className="text-left px-3 py-1.5">Apontamento (atual)</th>
                <th className="text-left px-3 py-1.5">Colaborador (origem)</th>
                <th className="text-center px-3 py-1.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.campo} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2 font-medium text-[var(--color-fg)]">{l.campo}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-muted)]">{l.valorApont || '—'}</td>
                  <td className="px-3 py-2 text-[var(--color-fg-muted)]">{l.valorColab || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {l.vaiPreencher ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success-fg)]">
                        copiar
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]">
                        manter
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {naoVaiCopiar.length > 0 && vaiCopiar.length === 0 && (
            <p className="text-xs text-[var(--color-fg-muted)] mb-4">
              Nada a copiar — o Apontamento RH já tem todos esses campos preenchidos (ou o Colaborador
              não tem valor para nenhum deles).
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleAplicar} disabled={vaiCopiar.length === 0 || aplicar.isPending}>
              {aplicar.isPending ? 'Aplicando…' : `Aplicar (${vaiCopiar.length})`}
            </Button>
          </div>
        </>
      )}

      {resultado !== null && (
        <div className="text-center py-4">
          <p className="text-base font-medium text-[var(--color-fg)] mb-2">
            {resultado.campos > 0
              ? `${resultado.campos} campo${resultado.campos > 1 ? 's' : ''} preenchido${resultado.campos > 1 ? 's' : ''}.`
              : 'Nenhum campo foi alterado.'}
          </p>
          {resultado.detalhe && (
            <p className="text-xs text-[var(--color-fg-muted)] mb-4">Campos: {resultado.detalhe}</p>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </div>
      )}
    </Modal>
  );
}

function Stat({
  label,
  value,
  accent = 'default',
}: {
  label: string;
  value: number;
  accent?: 'default' | 'success' | 'muted';
}) {
  const accentCls =
    accent === 'success'
      ? 'text-[var(--color-success-fg)]'
      : accent === 'muted'
      ? 'text-[var(--color-fg-muted)]'
      : 'text-[var(--color-fg)]';
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${accentCls}`}>{value}</p>
    </div>
  );
}

function ParCard({
  par,
  onVincular,
  onPular,
  loading,
}: {
  par: ParUnificacaoSugerido;
  onVincular: () => void;
  onPular: () => void;
  loading: boolean;
}) {
  const scoreCls =
    par.score >= 100
      ? 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]'
      : 'bg-[var(--color-accent-amber-soft)] text-[var(--color-accent-amber-fg)]';

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${scoreCls}`}>
          {par.motivo} · score {par.score}
        </span>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={onPular}>
            Pular
          </Button>
          <Button onClick={onVincular} disabled={loading}>
            {loading ? 'Vinculando…' : 'Vincular'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <PessoaBox
          titulo="Colaborador"
          nome={par.colaboradorNome}
          linhas={[
            { label: 'CPF', value: par.colaboradorCpf || '—' },
            { label: 'Empresa', value: par.colaboradorEmpresaId ? `id: ${par.colaboradorEmpresaId}` : '—' },
          ]}
        />
        <PessoaBox
          titulo="Funcionário (Apontamento RH)"
          nome={par.funcionarioNome}
          linhas={[
            { label: 'CPF', value: par.funcionarioCpf || '—' },
            { label: 'Função', value: par.funcionarioFuncao || '—' },
            { label: 'Vínculo', value: par.funcionarioTipoVinculo || '—' },
          ]}
        />
      </div>
    </div>
  );
}

function PessoaBox({
  titulo,
  nome,
  linhas,
}: {
  titulo: string;
  nome: string;
  linhas: { label: string; value: string }[];
}) {
  return (
    <div className="bg-[var(--color-surface-2)] rounded-lg p-3 border border-[var(--color-border)]">
      <p className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)] mb-1.5">{titulo}</p>
      <p className="text-sm font-medium text-[var(--color-fg)] mb-2">{nome}</p>
      <dl className="space-y-1">
        {linhas.map((l) => (
          <div key={l.label} className="flex gap-2 text-xs">
            <dt className="text-[var(--color-fg-subtle)] w-16">{l.label}:</dt>
            <dd className="text-[var(--color-fg-muted)]">{l.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
