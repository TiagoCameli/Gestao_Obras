// AnomaliaDrawer — painel lateral com detalhes da anomalia + ações
// contextuais por detector (F3.B).
//
// Conteúdo:
//   - Header: badge severidade + detector + data + título + descrição
//   - SaidasAfetadasList (compacta) — sempre exibida, mesmo pra single-saída
//   - Footer dinâmico:
//       D1 → combobox + "Atribuir" inline (resolve uma sentinel no spot)
//       D2/D3 → botão "Editar saída" (delega ao container)
//       D4 → [Excluir] inline em cada linha (user escolhe quais manter)
//       D5 → info-only (sem ação clicável; rota /frota não tem deep-link)
//
// Auto-close: useEffect detecta quando a anomalia selecionada some da
// lista (id determinístico) — significa "resolvida" → drawer fecha.

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Pencil, Undo2 } from 'lucide-react';
import type {
  Equipamento,
  Fornecedor,
  Insumo,
  Obra,
  SaidaCombustivel,
} from '../../../../types';
import Drawer from '../../../ui/Drawer';
import Button from '../../../ui/Button';
import FilterCombobox from '../../../ui/FilterCombobox';
import {
  DETECTOR_LABEL,
  SEVERITY_LABEL,
  type Anomalia,
  type Severidade,
} from './detect';
import SaidasAfetadasList from './SaidasAfetadasList';
import type { AnomaliaCheck } from '../../../../hooks/useAnomaliasChecks';
import { useAuth } from '../../../../contexts/AuthContext';

interface Props {
  anomalia: Anomalia | null;
  open: boolean;
  onClose: () => void;
  /** Saídas TODAS — pra resolver affectedSaidaIds em objetos completos. */
  saidasTodas: SaidaCombustivel[];
  obras: Obra[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  /** D2/D3: abre form de edição (delega ao container — fecha drawer no mesmo gesto). */
  onEditSaida: (s: SaidaCombustivel) => void;
  /** D4: exclui uma saída (container já encadeia password dialog). */
  onDeleteSaida: (id: string) => void;
  /** D1: atribui equipamento a 1 saída. Promise pra drawer mostrar loading. */
  onAtribuirEquipamento: (saida: SaidaCombustivel, equipamentoId: string) => Promise<void>;
  /** F3.D.2 — check status da anomalia atual (null = não verificada). */
  verificada?: AnomaliaCheck | null;
  /** F3.D.2 — handler de "marcar verificada" (caller pede motivo opcional + grava). */
  onMarcarVerificada?: (anomaliaId: string) => void;
  /** F3.D.2 — handler de "desfazer verificação". */
  onDesfazerVerificacao?: (anomaliaId: string) => void;
}

const SEVERITY_STYLES: Record<Severidade, {
  icon: typeof AlertCircle;
  badgeBg: string;
  badgeFg: string;
  iconColor: string;
}> = {
  critical: {
    icon: AlertCircle,
    badgeBg: 'bg-[var(--color-danger-soft)]',
    badgeFg: 'text-[var(--color-danger-fg)]',
    iconColor: 'text-[var(--color-danger)]',
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: 'bg-[var(--color-warning-soft)]',
    badgeFg: 'text-[var(--color-warning-fg)]',
    iconColor: 'text-[var(--color-warning)]',
  },
  info: {
    icon: Info,
    badgeBg: 'bg-[var(--color-info-soft)]',
    badgeFg: 'text-[var(--color-info-fg)]',
    iconColor: 'text-[var(--color-info)]',
  },
};

function fmtDataHoraBR(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export default function AnomaliaDrawer({
  anomalia,
  open,
  onClose,
  saidasTodas,
  obras,
  equipamentos,
  transportadoras,
  combustiveis,
  onEditSaida,
  onDeleteSaida,
  onAtribuirEquipamento,
  verificada,
  onMarcarVerificada,
  onDesfazerVerificacao,
}: Props) {
  // Estado local do form D1 (combobox + "Atribuir" inline)
  const [equipSelecionado, setEquipSelecionado] = useState<string>('');
  const [atribuindo, setAtribuindo] = useState(false);

  // Reset state ao trocar de anomalia
  useEffect(() => {
    setEquipSelecionado('');
    setAtribuindo(false);
  }, [anomalia?.id]);

  const saidasAfetadas = useMemo(() => {
    if (!anomalia) return [];
    const set = new Set(anomalia.affectedSaidaIds);
    return saidasTodas.filter((s) => set.has(s.id));
  }, [anomalia, saidasTodas]);

  const equipOptions = useMemo(
    () =>
      [...equipamentos]
        .filter((e) => e.ativo !== false)
        .sort((a, b) => (a.codigoPatrimonio || a.nome).localeCompare(b.codigoPatrimonio || b.nome))
        .map((e) => {
          const codigo = e.codigoPatrimonio || e.tipo || '';
          return { value: e.id, label: codigo ? `${codigo} · ${e.nome}` : e.nome };
        }),
    [equipamentos],
  );

  if (!anomalia) {
    return (
      <Drawer open={open} onClose={onClose} title="Anomalia" subtitle="Detalhes" width="lg">
        <div className="text-sm text-[var(--color-fg-muted)] italic">
          Anomalia não disponível.
        </div>
      </Drawer>
    );
  }

  const styles = SEVERITY_STYLES[anomalia.severity];
  const Icon = styles.icon;
  const dataLabel = anomalia.data.split('-').reverse().join('/');

  // Handlers contextuais
  function handleEditClick(s: SaidaCombustivel) {
    // Fecha drawer ANTES de abrir modal de edição — evita stack confuso
    // de drawer + modal no mesmo viewport.
    onClose();
    onEditSaida(s);
  }

  const { temAcao } = useAuth();
  const canCorrigir = temAcao('corrigir_anomalias_combustivel');
  async function handleAtribuir() {
    if (!canCorrigir) return;
    if (!equipSelecionado || saidasAfetadas.length === 0) return;
    setAtribuindo(true);
    try {
      await onAtribuirEquipamento(saidasAfetadas[0], equipSelecionado);
      // Sucesso → React Query invalida → anomalia D1 some da lista →
      // useEffect do AnomaliasTab fecha drawer + sinal visual de "resolvido".
    } catch (e) {
      console.error('[anomalia] falha ao atribuir', e);
      alert('Falha ao atribuir equipamento. Tente novamente.');
    } finally {
      setAtribuindo(false);
    }
  }

  // Footer muda conforme detector
  let footer: React.ReactNode = null;
  if (anomalia.detector === 'D1') {
    footer = (
      <div className="space-y-2">
        <label htmlFor="anomalia-equip-combobox" className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
          Atribuir equipamento à saída
        </label>
        <FilterCombobox
          value={equipSelecionado}
          onChange={setEquipSelecionado}
          options={equipOptions}
          placeholder="Buscar por código ou nome…"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={handleAtribuir}
            disabled={!equipSelecionado || atribuindo || saidasAfetadas.length === 0}
            className="text-sm"
          >
            {atribuindo ? 'Atribuindo…' : 'Atribuir'}
          </Button>
        </div>
      </div>
    );
  } else if (anomalia.detector === 'D2' || anomalia.detector === 'D3') {
    const saida = saidasAfetadas[0];
    footer = (
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => saida && handleEditClick(saida)}
          disabled={!saida}
          className="text-sm inline-flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar saída
        </Button>
      </div>
    );
  } else if (anomalia.detector === 'D5') {
    footer = (
      <div className="text-[11px] text-[var(--color-fg-muted)] italic">
        Sem ação direta — verifique o status do equipamento no módulo Frota
        (manutenção, ociosidade) ou desative no cadastro se aplicável.
      </div>
    );
  }
  // D4 não tem footer dedicado — a ação ([Excluir]) está em cada linha.

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={anomalia.title}
      subtitle={`${DETECTOR_LABEL[anomalia.detector]} · ${dataLabel}`}
      width="lg"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Banner severidade */}
        <div className={`rounded-lg ${styles.badgeBg} p-3 flex items-start gap-3`}>
          <Icon className={`w-5 h-5 ${styles.iconColor} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60 ${styles.badgeFg}`}>
                {SEVERITY_LABEL[anomalia.severity]}
              </span>
              <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">{anomalia.detector}</span>
            </div>
            <p className="text-sm text-[var(--color-fg)] mt-1">{anomalia.description}</p>
            {anomalia.acaoSugerida && (
              <p className="text-[11px] text-[var(--color-fg-muted)] italic mt-1.5">
                ↳ {anomalia.acaoSugerida}
              </p>
            )}
          </div>
        </div>

        {/* F3.D.2 — banner "verificada" ou botão "Marcar verificada" */}
        {verificada ? (
          <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-success-fg)]">
                Verificada
              </div>
              <p className="text-sm text-[var(--color-fg)] mt-0.5">
                {verificada.checkedBy ? `por ${verificada.checkedBy} · ` : ''}
                {fmtDataHoraBR(verificada.checkedAt)}
              </p>
              {verificada.motivo && (
                <p className="text-[11px] text-[var(--color-fg-muted)] italic mt-1">
                  "{verificada.motivo}"
                </p>
              )}
            </div>
            {onDesfazerVerificacao && (
              <Button
                type="button"
                onClick={() => onDesfazerVerificacao(anomalia.id)}
                className="text-xs inline-flex items-center gap-1 shrink-0"
                variant="secondary"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Desfazer
              </Button>
            )}
          </div>
        ) : onMarcarVerificada ? (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => onMarcarVerificada(anomalia.id)}
              className="text-xs inline-flex items-center gap-1.5"
              variant="secondary"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marcar como verificada
            </Button>
          </div>
        ) : null}

        {/* Lista compacta de saídas afetadas */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Saídas afetadas ({saidasAfetadas.length})
          </div>
          <SaidasAfetadasList
            saidas={saidasAfetadas}
            obras={obras}
            equipamentos={equipamentos}
            transportadoras={transportadoras}
            combustiveis={combustiveis}
            onDelete={anomalia.detector === 'D4' ? onDeleteSaida : undefined}
            busy={atribuindo}
          />
        </div>
      </div>
    </Drawer>
  );
}
