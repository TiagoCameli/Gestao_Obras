import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAdicionarEquipamento } from '../../../hooks/useEquipamentos';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { useEquipamentoModelos } from '../hooks/useEquipamentoModelos';
import {
  updateModeloEquipamento,
  updateHorimetroAtual,
  marcarHorimetroNaoFuncional,
} from '../utils/equipamentosManutencaoApi';
import { gerarAgendaInicial } from '../utils/manutencaoAgendamentosApi';
import { ACOES_MANUTENCAO } from '../types';
import type { Equipamento } from '../../../types';

function novoIdEquipamento(): string {
  return crypto.randomUUID();
}

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function EquipamentoNovoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();
  const podeEditar = temAcao(ACOES_MANUTENCAO.editar);

  const modelos = useEquipamentoModelos({ ativo: true });
  const adicionar = useAdicionarEquipamento();

  const [patrimony, setPatrimony] = useState('');
  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [dataAquisicao, setDataAquisicao] = useState(hojeIso());
  const [modeloId, setModeloId] = useState('');
  const [prefixoSerie, setPrefixoSerie] = useState('');
  const [horimetroFuncional, setHorimetroFuncional] = useState(true);
  const [horimetroAtual, setHorimetroAtual] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!podeEditar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para cadastrar equipamentos.
      </Card>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    setErro(null);

    if (!patrimony.trim()) return setErro('Patrimônio obrigatório.');
    if (!nome.trim()) return setErro('Nome obrigatório.');

    setSubmitting(true);
    try {
      const novoId = novoIdEquipamento();
      const novo: Equipamento = {
        id: novoId,
        nome: nome.trim(),
        tipo: '',
        empresaId: '',
        codigoPatrimonio: patrimony.trim(),
        numeroSerie: '',
        ano: '',
        marca: '',
        tipoMedicao: 'horimetro',
        medicaoInicial: 0,
        ativo,
        dataAquisicao,
        dataVenda: '',
        criadoPor: usuario.funcionarioId,
      };

      await adicionar.mutateAsync(novo);

      if (modeloId) {
        await updateModeloEquipamento(novoId, modeloId, prefixoSerie || undefined);
      }

      if (!horimetroFuncional) {
        await marcarHorimetroNaoFuncional(novoId, '');
      } else if (horimetroAtual.trim() !== '') {
        const valor = Number(horimetroAtual);
        if (Number.isFinite(valor)) {
          await updateHorimetroAtual(novoId, valor, usuario.funcionarioId);
        }
      }

      let qtdAgendada = 0;
      if (modeloId) {
        const dataLabel = new Date(dataAquisicao + 'T00:00:00').toLocaleDateString('pt-BR');
        const gerar = confirm(
          `Modelo associado. Gerar cronograma de manutenção a partir da data de aquisição (${dataLabel})? Você ainda pode ajustar agendamentos individuais depois.`
        );
        if (gerar) {
          try {
            const agend = await gerarAgendaInicial(novoId, dataAquisicao, usuario.funcionarioId);
            qtdAgendada = agend.length;
          } catch (e) {
            alert(
              'Equipamento criado, mas a agenda inicial não foi gerada: ' +
                (e instanceof Error ? e.message : String(e))
            );
          }
        }
      } else {
        alert(
          'Equipamento salvo. Para gerar cronograma de manutenção, associe um modelo depois.'
        );
      }

      await qc.invalidateQueries({ queryKey: ['manutencao'] });
      await qc.invalidateQueries({ queryKey: ['equipamentos'] });

      if (qtdAgendada > 0) {
        alert(`${qtdAgendada} manutenção(ões) agendada(s) automaticamente.`);
      }

      navigate(`/manutencao/frota/${novoId}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar equipamento.');
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
        <span className="text-[var(--color-fg)] font-medium">Novo</span>
      </nav>

      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Cadastrar equipamento</h2>

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
            <div>
              <Input
                id="eq-data"
                label="Data de aquisição"
                type="date"
                value={dataAquisicao}
                onChange={(e) => setDataAquisicao(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                Usada para calcular cronograma de manutenção quando você associa um modelo.
                Para máquinas usadas, prefira a data em que foi adquirida pela EMT.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm pt-7">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Equipamento ativo
            </label>
          </div>
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
            <Input
              id="eq-horimetro"
              label="Horímetro inicial (h)"
              type="number"
              step="0.1"
              value={horimetroAtual}
              onChange={(e) => setHorimetroAtual(e.target.value)}
            />
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
            {submitting ? 'Criando...' : 'Criar equipamento'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export { EquipamentoNovoPage };
