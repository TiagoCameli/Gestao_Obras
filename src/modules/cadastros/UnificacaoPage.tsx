import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import {
  useSugestoesUnificacao,
  useVincularColaboradorFuncionario,
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
    </div>
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
