import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useEquipamentos, useAtualizarEquipamento } from '../../../hooks/useEquipamentos';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Card from '../../../components/ui/Card';
import { useEquipamentoModelos } from '../hooks/useEquipamentoModelos';
import HorimetroLeituraForm, {
  type HorimetroLeituraFormData,
} from '../components/forms/HorimetroLeituraForm';
import ManutencaoLoadingState from '../components/shared/ManutencaoLoadingState';
import ManutencaoErrorState from '../components/shared/ManutencaoErrorState';
import {
  updateModeloEquipamento,
  updateHorimetroAtual,
  marcarHorimetroNaoFuncional,
  getEquipamentoComManutencao,
} from '../utils/equipamentosManutencaoApi';
import { addLeituraHorimetro, getUltimaLeitura } from '../utils/horimetroApi';
import { gerarAgendaInicial } from '../utils/manutencaoAgendamentosApi';
import { supabase } from '../../../lib/supabase';
import { ACOES_MANUTENCAO } from '../types';
import type { HorimetroLeitura } from '../types';
import type { Equipamento } from '../../../types';

export default function EquipamentoEditarPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();

  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);
  const equipamentos = useEquipamentos();
  const modelos = useEquipamentoModelos({ ativo: true });
  const atualizar = useAtualizarEquipamento();

  const equipamento = useMemo(
    () => equipamentos.data?.find((e) => e.id === id),
    [equipamentos.data, id]
  );

  const [nome, setNome] = useState('');
  const [patrimony, setPatrimony] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [dataAquisicao, setDataAquisicao] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [prefixoSerie, setPrefixoSerie] = useState('');
  const [horimetroFuncional, setHorimetroFuncional] = useState(true);
  const [horimetroAtual, setHorimetroAtual] = useState<string>('');
  const [horimetroOriginal, setHorimetroOriginal] = useState<number | undefined>(undefined);
  const [modeloOriginal, setModeloOriginal] = useState<string>('');
  const [prefixoOriginal, setPrefixoOriginal] = useState<string>('');
  const [horimetroFuncionalOriginal, setHorimetroFuncionalOriginal] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [leituraOpen, setLeituraOpen] = useState(false);
  const [ultimaLeitura, setUltimaLeitura] = useState<HorimetroLeitura | undefined>(undefined);

  useEffect(() => {
    if (!equipamento) return;
    setNome(equipamento.nome);
    setPatrimony(equipamento.codigoPatrimonio);
    setAtivo(equipamento.ativo);
    setDataAquisicao(equipamento.dataAquisicao || '');
  }, [equipamento]);

  useEffect(() => {
    if (!id) return;
    let cancelado = false;
    (async () => {
      const eq = await getEquipamentoComManutencao(id);
      if (cancelado || !eq) return;
      setModeloId(eq.modeloId ?? '');
      setModeloOriginal(eq.modeloId ?? '');
      setPrefixoSerie(eq.prefixoSerie ?? '');
      setPrefixoOriginal(eq.prefixoSerie ?? '');
      setHorimetroFuncional(eq.horimetroFuncional);
      setHorimetroFuncionalOriginal(eq.horimetroFuncional);
      setHorimetroAtual(eq.horimetroAtual !== undefined ? String(eq.horimetroAtual) : '');
      setHorimetroOriginal(eq.horimetroAtual);
      const ult = await getUltimaLeitura(id);
      if (!cancelado) setUltimaLeitura(ult ?? undefined);
    })().catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [id]);

  if (!podeEditar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para editar equipamentos.
      </Card>
    );
  }

  if (equipamentos.isLoading) return <ManutencaoLoadingState />;
  if (equipamentos.error) {
    return <ManutencaoErrorState erro={equipamentos.error} onRetry={() => equipamentos.refetch()} />;
  }
  if (!equipamento) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Equipamento "{id}" não encontrado.
      </Card>
    );
  }

  async function handleAddLeitura(data: HorimetroLeituraFormData) {
    if (!usuario) throw new Error('Sem usuário');
    await addLeituraHorimetro({
      equipamentoId: data.equipamentoId,
      dataLeitura: data.dataLeitura,
      valor: data.valor,
      observacao: data.observacao,
      origem: 'manual',
      criadoPor: usuario.funcionarioId,
    });
    setHorimetroAtual(String(data.valor));
    setLeituraOpen(false);
    await qc.invalidateQueries({ queryKey: ['manutencao'] });
    setUltimaLeitura((await getUltimaLeitura(id)) ?? undefined);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    setErro(null);
    setSubmitting(true);
    try {
      const updated: Equipamento = {
        ...equipamento!,
        nome: nome.trim(),
        codigoPatrimonio: patrimony.trim(),
        ativo,
        dataAquisicao: dataAquisicao.trim(),
      };
      await atualizar.mutateAsync(updated);

      const associouModelo = !!modeloId && !modeloOriginal;
      if (modeloId !== modeloOriginal || prefixoSerie !== prefixoOriginal) {
        if (modeloId) {
          await updateModeloEquipamento(id, modeloId, prefixoSerie || undefined);
        } else {
          const { error } = await supabase
            .from('equipamentos')
            .update({ modelo_id: null, prefixo_serie: null })
            .eq('id', id);
          if (error) throw error;
        }
      }

      if (!horimetroFuncional && horimetroFuncionalOriginal) {
        await marcarHorimetroNaoFuncional(id, '');
      } else if (horimetroFuncional && !horimetroFuncionalOriginal) {
        const { error } = await supabase
          .from('equipamentos')
          .update({ horimetro_funcional: true })
          .eq('id', id);
        if (error) throw error;
      }

      if (horimetroFuncional && horimetroAtual.trim() !== '') {
        const valor = Number(horimetroAtual);
        if (Number.isFinite(valor) && valor !== horimetroOriginal) {
          await updateHorimetroAtual(id, valor, usuario.funcionarioId);
        }
      }

      // Se acabou de associar um modelo, oferecer geração da agenda baseada
      // na data de aquisição informada.
      if (associouModelo) {
        const dataRef = dataAquisicao.trim() || new Date().toISOString().slice(0, 10);
        const dataLabel = new Date(dataRef + 'T00:00:00').toLocaleDateString('pt-BR');
        const gerar = confirm(
          `Modelo associado. Gerar cronograma de manutenção a partir da data de aquisição (${dataLabel})? Você ainda pode ajustar agendamentos individuais depois.`
        );
        if (gerar) {
          try {
            const novos = await gerarAgendaInicial(id, dataRef, usuario.funcionarioId);
            alert(`${novos.length} manutenção(ões) agendada(s).`);
          } catch (e) {
            alert(
              'Modelo salvo, mas a agenda não pôde ser gerada: ' +
                (e instanceof Error ? e.message : String(e))
            );
          }
        }
      }

      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      await qc.invalidateQueries({ queryKey: ['equipamentos'] });
      navigate(`/manutencao/frota/${id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1">
        <Link to="/manutencao/frota" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Frota
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <Link to={`/manutencao/frota/${id}`} className="hover:text-[var(--color-fg)]">
          {patrimony}
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">Editar</span>
      </nav>

      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Editar equipamento</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Card className="!p-4 flex flex-col gap-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              id="eq-patrimony"
              label="Patrimônio"
              value={patrimony}
              onChange={(e) => setPatrimony(e.target.value)}
              required
            />
            <Input
              id="eq-nome"
              label="Nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              id="eq-data-aquisicao"
              label="Data de aquisição"
              type="date"
              value={dataAquisicao}
              onChange={(e) => setDataAquisicao(e.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
              Usada para calcular cronograma de manutenção quando você associa um modelo.
              Para máquinas usadas, prefira a data em que foi adquirida pela EMT.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
            />
            Equipamento ativo
          </label>
        </Card>

        <Card className="!p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Modelo</h3>
          <div>
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5">
              Modelo do catálogo
            </label>
            <select
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
              className="w-full h-[42px] rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">— sem modelo —</option>
              {(modelos.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fabricante} {m.modeloNome} ({m.id})
                </option>
              ))}
            </select>
          </div>
          {modeloId && (
            <Input
              id="eq-prefixo"
              label="Prefixo de série"
              value={prefixoSerie}
              onChange={(e) => setPrefixoSerie(e.target.value.toUpperCase())}
              placeholder="Ex.: ANB"
            />
          )}
        </Card>

        <Card className="!p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-fg)]">Horímetro</h3>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={horimetroFuncional}
              onChange={(e) => setHorimetroFuncional(e.target.checked)}
            />
            Horímetro funcional
          </label>
          {horimetroFuncional && (
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <Input
                id="eq-horimetro"
                label="Horímetro atual (h)"
                type="number"
                step="0.1"
                value={horimetroAtual}
                onChange={(e) => setHorimetroAtual(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={() => setLeituraOpen(true)}>
                Adicionar leitura
              </Button>
            </div>
          )}
        </Card>

        {erro && (
          <div role="alert" className="text-xs px-3 py-2 rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/30">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>

      <Modal open={leituraOpen} onClose={() => setLeituraOpen(false)} title="Nova leitura de horímetro">
        <div className="p-4 sm:p-5">
          <HorimetroLeituraForm
            equipamentoId={id}
            ultimaLeitura={ultimaLeitura}
            onSubmit={handleAddLeitura}
            onCancel={() => setLeituraOpen(false)}
          />
        </div>
      </Modal>
    </div>
  );
}

export { EquipamentoEditarPage };
