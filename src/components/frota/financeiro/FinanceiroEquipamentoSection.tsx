// Marco 1 / PR7 — Seção Financeiro no detalhe do equipamento.
//
// Render adaptativo conforme propriedade:
//   - propria   → aquisição, financiamento, valor de mercado, depreciação
//   - alugada   → locadora, valor mensal, vigência, o que está incluso

import { useState } from 'react';
import {
  Banknote, FileText, Building2, Clock, Calendar,
  Wrench, Pencil, Plus, ShieldAlert,
} from 'lucide-react';
import type { Equipamento, Fornecedor } from '../../../types';
import { useFinanceiroEquipamento, useSalvarFinanceiroEquipamento } from '../../../hooks/useFinanceiroEquipamento';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/Button';
import FinanceiroFormModal from './FinanceiroFormModal';

interface Props {
  equipamento: Equipamento;
  fornecedores: Fornecedor[];
}

const FORMA_AQUISICAO_LABEL: Record<string, string> = {
  a_vista: 'À vista',
  financiado: 'Financiado',
  consorcio: 'Consórcio',
  leasing: 'Leasing',
  outro: 'Outro',
};

function fmtBRL(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(s: string | null): string {
  if (!s) return '—';
  const [a, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function diasParaVencer(s: string | null): number | null {
  if (!s) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const v = new Date(s); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoje.getTime()) / 86400000);
}

function Bloco({
  titulo, icon: Icon, children,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
        <Icon aria-hidden className="w-3.5 h-3.5" />
        {titulo}
      </div>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--color-fg-muted)] text-xs">{label}</dt>
      <dd className="text-[var(--color-fg)] font-medium text-sm text-right truncate">
        {valor === null || valor === undefined || valor === '' ? (
          <span className="text-[var(--color-fg-subtle)] font-normal">—</span>
        ) : (
          valor
        )}
      </dd>
    </div>
  );
}

export default function FinanceiroEquipamentoSection({ equipamento, fornecedores }: Props) {
  const { data: fin, isLoading } = useFinanceiroEquipamento(equipamento.id);
  const { temAcao, usuario } = useAuth();
  const salvarMutation = useSalvarFinanceiroEquipamento();
  const [formOpen, setFormOpen] = useState(false);

  const canEdit = temAcao('editar_cadastros');
  const isAlugada = equipamento.propriedade === 'alugada';

  const fornNome = (id: string | null) =>
    id ? fornecedores.find((f) => f.id === id)?.nome ?? '—' : '—';

  async function handleSalvar(novo: typeof fin) {
    if (!novo) return;
    await salvarMutation.mutateAsync({
      ...novo,
      updatedBy: usuario?.nome ?? '',
      createdBy: fin?.createdBy || (usuario?.nome ?? ''),
    });
  }

  // Depreciação mensal estimada (linear)
  const depreciacaoMensal =
    !isAlugada
      && fin?.valorAquisicao != null
      && fin?.vidaUtilMeses != null
      && fin.vidaUtilMeses > 0
      ? ((fin.valorAquisicao - (fin.valorResidualEstimado ?? 0)) / fin.vidaUtilMeses)
      : null;

  // Alerta vigência vencendo
  const diasVigencia = isAlugada ? diasParaVencer(fin?.vigenciaFim ?? null) : null;
  const alertaVigencia =
    diasVigencia !== null && diasVigencia <= 60
      ? diasVigencia < 0
        ? `Contrato venceu há ${Math.abs(diasVigencia)} dia(s)`
        : `Contrato vence em ${diasVigencia} dia(s)`
      : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Financeiro
          {isAlugada && (
            <span className="ml-2 text-[var(--color-fg-subtle)] font-normal lowercase">
              (alugado)
            </span>
          )}
        </h3>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
            {fin ? (<><Pencil aria-hidden className="w-3.5 h-3.5" /> Editar</>)
                 : (<><Plus aria-hidden className="w-3.5 h-3.5" /> Adicionar</>)}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-2">Carregando financeiro…</p>
      ) : !fin ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center">
          <Banknote aria-hidden className="w-6 h-6 text-[var(--color-fg-subtle)] mx-auto mb-1.5" />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhuma informação financeira cadastrada.
          </p>
          {canEdit && (
            <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
              {isAlugada
                ? 'Cadastre locadora, contrato, valor mensal, vigência e o que está incluso.'
                : 'Cadastre valor de aquisição, fornecedor, forma de pagamento e vida útil.'}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {alertaVigencia && (
            <div className={
              'md:col-span-2 lg:col-span-3 rounded-xl border p-3 flex items-center gap-2 text-sm ' +
              (diasVigencia! < 0
                ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border-[var(--color-danger)]/30'
                : 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] border-[var(--color-warning)]/30')
            }>
              <ShieldAlert aria-hidden className="w-4 h-4 shrink-0" />
              <span className="font-medium">{alertaVigencia}</span>
            </div>
          )}

          {isAlugada ? (
            <>
              <Bloco titulo="Locação" icon={Building2}>
                <Linha label="Locadora" valor={fornNome(fin.locadoraId)} />
                <Linha label="Nº contrato" valor={fin.contratoNumero || null} />
                <Linha label="Valor mensal" valor={fmtBRL(fin.valorMensal)} />
                <Linha label="Indexador" valor={fin.indexador} />
              </Bloco>
              <Bloco titulo="Vigência" icon={Calendar}>
                <Linha label="Início" valor={fmtData(fin.vigenciaInicio)} />
                <Linha label="Fim" valor={fmtData(fin.vigenciaFim)} />
                <Linha label="Horas mínimas/mês" valor={fin.horasMinimasMensais} />
              </Bloco>
              <Bloco titulo="O que está incluso" icon={Wrench}>
                <Linha
                  label="Manutenção"
                  valor={
                    <span className={fin.manutencaoInclusa ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-fg-subtle)]'}>
                      {fin.manutencaoInclusa ? 'Sim' : 'Não'}
                    </span>
                  }
                />
                <Linha
                  label="Combustível"
                  valor={
                    <span className={fin.combustivelIncluso ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-fg-subtle)]'}>
                      {fin.combustivelIncluso ? 'Sim' : 'Não'}
                    </span>
                  }
                />
                <Linha
                  label="Operador"
                  valor={
                    <span className={fin.operadorIncluso ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-fg-subtle)]'}>
                      {fin.operadorIncluso ? 'Sim' : 'Não'}
                    </span>
                  }
                />
              </Bloco>
            </>
          ) : (
            <>
              <Bloco titulo="Aquisição" icon={Banknote}>
                <Linha label="Valor" valor={fmtBRL(fin.valorAquisicao)} />
                <Linha label="Forma" valor={fin.formaAquisicao ? FORMA_AQUISICAO_LABEL[fin.formaAquisicao] : null} />
                <Linha label="Fornecedor" valor={fornNome(fin.fornecedorAquisicaoId)} />
                <Linha label="NF" valor={fin.nfAquisicao ? <span className="font-mono text-xs">{fin.nfAquisicao}</span> : null} />
              </Bloco>
              {(fin.formaAquisicao === 'financiado' || fin.formaAquisicao === 'consorcio' || fin.formaAquisicao === 'leasing') && (
                <Bloco titulo="Financiamento" icon={FileText}>
                  <Linha label="Banco / financiador" valor={fin.bancoFinanciador || null} />
                  <Linha label="Valor da parcela" valor={fmtBRL(fin.valorParcela)} />
                  <Linha
                    label="Prestações"
                    valor={
                      fin.prestacoesTotal != null
                        ? `${fin.prestacoesPagas ?? 0} / ${fin.prestacoesTotal}`
                        : null
                    }
                  />
                </Bloco>
              )}
              <Bloco titulo="Valor de mercado & vida útil" icon={Clock}>
                <Linha label="Valor mercado atual" valor={fmtBRL(fin.valorMercadoAtual)} />
                <Linha label="Vida útil estimada" valor={fin.vidaUtilMeses != null ? `${fin.vidaUtilMeses} meses` : null} />
                <Linha label="Valor residual" valor={fmtBRL(fin.valorResidualEstimado)} />
                <Linha
                  label="Depreciação / mês"
                  valor={depreciacaoMensal != null ? fmtBRL(depreciacaoMensal) : null}
                />
              </Bloco>
            </>
          )}

          {fin.observacoes && (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
                Observações
              </div>
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{fin.observacoes}</p>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <FinanceiroFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          equipamento={equipamento}
          fornecedores={fornecedores}
          initial={fin ?? null}
          onSubmit={handleSalvar}
        />
      )}
    </section>
  );
}
