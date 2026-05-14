// Marco 1 / PR6 — Seção de Especificações Técnicas no detalhe do equipamento.
//
// Mostra cards read-only agrupados (Capacidades, Lubrificantes, Filtros,
// Pneus & Bateria, Consumo esperado, Garantia). Botão "Editar especificações"
// abre EspecificacoesFormModal. Estado vazio: orienta o usuário a preencher.

import { useState } from 'react';
import {
  Wrench, Droplets, Filter, Disc, Battery, Gauge, ShieldCheck,
  Pencil, Plus,
} from 'lucide-react';
import type { Equipamento } from '../../../types';
import { useEspecificacoesEquipamento, useSalvarEspecificacoes } from '../../../hooks/useEspecificacoesEquipamento';
import { useAuth } from '../../../contexts/AuthContext';
import Button from '../../ui/Button';
import EspecificacoesFormModal from './EspecificacoesFormModal';

interface Props {
  equipamento: Equipamento;
}

function Bloco({
  titulo,
  icon: Icon,
  children,
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

function fmtL(v: number | null | undefined): string | null {
  if (v == null) return null;
  return `${v.toLocaleString('pt-BR')} L`;
}

function fmtData(s: string | null): string | null {
  if (!s) return null;
  const [a, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export default function EspecificacoesEquipamentoSection({ equipamento }: Props) {
  const { data: spec, isLoading } = useEspecificacoesEquipamento(equipamento.id);
  const { temAcao, usuario } = useAuth();
  const salvarMutation = useSalvarEspecificacoes();
  const [formOpen, setFormOpen] = useState(false);

  const canEdit = temAcao('editar_especificacoes_equipamento');

  async function handleSalvar(novo: typeof spec) {
    if (!novo) return;
    if (!canEdit) return;
    await salvarMutation.mutateAsync({
      ...novo,
      updatedBy: usuario?.nome ?? '',
      createdBy: spec?.createdBy || (usuario?.nome ?? ''),
    });
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
          Especificações técnicas
        </h3>
        {canEdit && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setFormOpen(true)}
          >
            {spec ? (
              <>
                <Pencil aria-hidden className="w-3.5 h-3.5" />
                Editar
              </>
            ) : (
              <>
                <Plus aria-hidden className="w-3.5 h-3.5" />
                Adicionar
              </>
            )}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-2">Carregando especificações…</p>
      ) : !spec ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 text-center">
          <Wrench
            aria-hidden
            className="w-6 h-6 text-[var(--color-fg-subtle)] mx-auto mb-1.5"
          />
          <p className="text-sm text-[var(--color-fg-muted)]">
            Nenhuma especificação cadastrada.
          </p>
          {canEdit && (
            <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
              Cadastre capacidades de óleo, códigos dos filtros, medida do pneu, garantia.
              Essas informações ficam à mão do mecânico em campo.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Bloco titulo="Capacidades" icon={Droplets}>
            <Linha label="Tanque combustível" valor={fmtL(spec.capacidadeTanqueL)} />
            <Linha label="Óleo motor" valor={fmtL(spec.capacidadeOleoMotorL)} />
            <Linha label="Óleo hidráulico" valor={fmtL(spec.capacidadeOleoHidraulicoL)} />
            <Linha label="Óleo transmissão" valor={fmtL(spec.capacidadeOleoTransmissaoL)} />
            <Linha label="Óleo diferencial" valor={fmtL(spec.capacidadeOleoDiferencialL)} />
            <Linha label="Arrefecedor" valor={fmtL(spec.capacidadeArrefecedorL)} />
          </Bloco>

          <Bloco titulo="Lubrificantes (tipo)" icon={Droplets}>
            <Linha label="Óleo motor" valor={spec.tipoOleoMotor} />
            <Linha label="Óleo hidráulico" valor={spec.tipoOleoHidraulico} />
            <Linha label="Óleo transmissão" valor={spec.tipoOleoTransmissao} />
          </Bloco>

          <Bloco titulo="Filtros (códigos OEM)" icon={Filter}>
            {Object.keys(spec.filtros).length === 0 ? (
              <Linha label="—" valor={null} />
            ) : (
              Object.entries(spec.filtros).map(([chave, valor]) => (
                <Linha
                  key={chave}
                  label={chave.charAt(0).toUpperCase() + chave.slice(1)}
                  valor={<span className="font-mono text-xs">{valor || '—'}</span>}
                />
              ))
            )}
          </Bloco>

          <Bloco titulo="Pneus" icon={Disc}>
            <Linha label="Medida" valor={spec.pneuMedida} />
            <Linha label="Quantidade" valor={spec.pneuQtd} />
          </Bloco>

          <Bloco titulo="Bateria" icon={Battery}>
            <Linha label="Especificação" valor={spec.bateriaEspecificacao} />
            <Linha label="Quantidade" valor={spec.bateriaQtd} />
          </Bloco>

          <Bloco titulo="Consumo esperado" icon={Gauge}>
            <Linha
              label="L / hora"
              valor={spec.consumoEsperadoLH != null ? `${spec.consumoEsperadoLH} L/h` : null}
            />
            <Linha
              label="Km / L"
              valor={spec.consumoEsperadoKmL != null ? `${spec.consumoEsperadoKmL} km/L` : null}
            />
          </Bloco>

          <Bloco titulo="Garantia" icon={ShieldCheck}>
            <Linha label="Fim (data)" valor={fmtData(spec.garantiaFimData)} />
            <Linha
              label="Fim (medição)"
              valor={
                spec.garantiaFimMedicao != null
                  ? `${spec.garantiaFimMedicao.toLocaleString('pt-BR')} ${equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km'}`
                  : null
              }
            />
          </Bloco>

          {spec.observacoesTecnicas && (
            <div className="md:col-span-2 lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5">
                Notas técnicas
              </div>
              <p className="text-sm text-[var(--color-fg)] whitespace-pre-line">{spec.observacoesTecnicas}</p>
            </div>
          )}
        </div>
      )}

      {formOpen && (
        <EspecificacoesFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          equipamento={equipamento}
          initial={spec ?? null}
          onSubmit={handleSalvar}
        />
      )}
    </section>
  );
}
