// Marco 7 / PR32 — Hub do equipamento (cai aqui ao escanear o QR).
//
// Cards grandes com as ações disponíveis pra esse equipamento, filtrados
// pela permissão do usuário logado. Layout pensado pra dedo grande na obra.

import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardList, Gauge, FilePlus, Droplet, BookOpen, Info,
  ChevronRight, Wrench, AlertTriangle,
} from 'lucide-react';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useDocumentosEquipamento } from '../../hooks/useDocumentosEquipamento';
import { useAuth } from '../../contexts/AuthContext';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import { STATUS_EQUIPAMENTO_LABEL } from '../../types';

interface AcaoCard {
  to: string;
  titulo: string;
  descricao: string;
  icon: React.ComponentType<{ className?: string }>;
  cor: string;
}

export default function MEquipamentoHubPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const { temAcao } = useAuth();
  const { data: equipamentos = [], isLoading } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);
  const { data: documentos = [] } = useDocumentosEquipamento(equipamentoId ?? null);

  // Permissões: chaves específicas do grupo Mobile (audit Fase 5 #19/#20).
  const podeChecklist = temAcao('executar_checklist_mobile');
  const podeMedicao = temAcao('lancar_medicao_mobile');
  const podeAbrirOS = temAcao('abrir_os_mobile');
  const podeSaidaCombustivel = temAcao('saida_combustivel_mobile');

  // Catálogo de peças: documento do tipo 'catalogo_pecas' com arquivo anexado
  const catalogoPecas = documentos.find(
    (d) => d.tipo === 'catalogo_pecas' && (d.arquivoUrls?.length ?? 0) > 0
  );
  const catalogoUrl = catalogoPecas?.arquivoUrls?.[0] ?? '';

  if (isLoading) {
    return <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando…</p>;
  }

  if (!equipamento) {
    return (
      <div className="space-y-3">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--color-danger-fg)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-danger-fg)]">Equipamento não encontrado</p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Pode ter sido removido. Procure o gerente.
          </p>
        </div>
      </div>
    );
  }

  const cat = getCategoriaFrota(equipamento.tipo);
  const unidade = equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km';

  const acoes: AcaoCard[] = [];

  acoes.push({
    to: `/m/eq/${equipamento.id}/info`,
    titulo: 'Informações',
    descricao: 'Dados, especs e histórico do equipamento',
    icon: Info,
    cor: 'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  });

  if (podeChecklist) {
    acoes.push({
      to: `/m/checklist/${equipamento.id}`,
      titulo: 'Checklist pré-uso',
      descricao: 'Inspeção diária antes de operar',
      icon: ClipboardList,
      cor: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]',
    });
  }

  if (podeMedicao) {
    acoes.push({
      to: `/m/medicao/${equipamento.id}`,
      titulo: 'Apontar medição',
      descricao: `Registrar leitura do ${equipamento.tipoMedicao === 'horimetro' ? 'horímetro' : 'odômetro'}`,
      icon: Gauge,
      cor: 'bg-[var(--color-surface-2)] text-[var(--color-fg)]',
    });
  }

  if (podeSaidaCombustivel) {
    acoes.push({
      to: `/m/saida-combustivel/${equipamento.id}`,
      titulo: 'Saída de combustível',
      descricao: 'Registrar abastecimento do equipamento',
      icon: Droplet,
      cor: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]',
    });
  }

  if (podeAbrirOS) {
    acoes.push({
      to: `/m/abrir-os/${equipamento.id}`,
      titulo: 'Abrir ordem de serviço',
      descricao: 'Relatar quebra ou ajuste necessário',
      icon: FilePlus,
      cor: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]',
    });
  }

  if (catalogoPecas && catalogoUrl) {
    acoes.push({
      to: catalogoUrl,
      titulo: 'Catálogo de peças',
      descricao: 'PDF com peças e códigos do fabricante',
      icon: BookOpen,
      cor: 'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
    });
  }

  return (
    <div className="space-y-3">
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
        <ArrowLeft className="w-4 h-4" /> Lista de equipamentos
      </Link>

      {/* Card de identificação */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-1)]">
        <div aria-hidden className={`h-1.5 ${cat.cor}`} />
        <div className="p-3 flex items-start gap-3">
          <span
            aria-hidden
            className={`shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-xl ${cat.corBg}`}
          >
            <span className={`text-sm font-bold ${cat.corTexto}`}>{cat.codigo}</span>
          </span>
          <div className="min-w-0 flex-1">
            {equipamento.codigoPatrimonio && (
              <div className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
                {equipamento.codigoPatrimonio}
              </div>
            )}
            <h1 className="text-base font-semibold text-[var(--color-fg)]">
              {equipamento.nome}
            </h1>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {equipamento.tipo}
              {equipamento.modelo && ` · ${equipamento.modelo}`}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                {STATUS_EQUIPAMENTO_LABEL[equipamento.status] ?? equipamento.status}
              </span>
              {medicaoAtual && (
                <span className="text-[11px] font-mono text-[var(--color-fg-muted)]">
                  {medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} {unidade}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de ação */}
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] pt-1 px-1">
        O que você quer fazer?
      </h2>
      <div className="space-y-2">
        {acoes.map((acao) => {
          const externo = acao.to.startsWith('http');
          const conteudo = (
            <>
              <div className={'shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl ' + acao.cor}>
                <acao.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[var(--color-fg)]">{acao.titulo}</div>
                <div className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">{acao.descricao}</div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-fg-subtle)] shrink-0" />
            </>
          );
          return externo ? (
            <a
              key={acao.to + acao.titulo}
              href={acao.to}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] active:bg-[var(--color-surface-2)]"
            >
              {conteudo}
            </a>
          ) : (
            <Link
              key={acao.to + acao.titulo}
              to={acao.to}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] active:bg-[var(--color-surface-2)]"
            >
              {conteudo}
            </Link>
          );
        })}
      </div>

      {acoes.length === 1 && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-4 text-center">
          <Wrench className="w-6 h-6 text-[var(--color-fg-subtle)] mx-auto mb-1" />
          <p className="text-xs text-[var(--color-fg-muted)]">
            Você não tem permissão para outras ações. Fale com o gerente.
          </p>
        </div>
      )}
    </div>
  );
}
