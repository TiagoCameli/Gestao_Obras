// Cadastro rápido de Insumo (material) dentro de uma OC ou pedido.
//
// Diferente do PecaFormModal (que marca usadoEmManutencao=true e tem
// muitos campos técnicos), este aqui é o mínimo necessário: nome,
// unidade, categoria. Suficiente para destrancar o fluxo de compra sem
// abrir outra tela. Depois o usuário pode enriquecer o cadastro pelo
// módulo de Cadastros → Insumos.

import { useState, type FormEvent } from 'react';
import type { Insumo, CategoriaMaterialCompra } from '../../types';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useAdicionarInsumo } from '../../hooks/useInsumos';
import { useUnidades } from '../../hooks/useUnidades';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nome inicial — pode vir do que o usuário já estava digitando no item da OC */
  nomeInicial?: string;
  /** Categorias disponíveis (vindas de Cadastros → Categorias de Material) */
  categorias: { value: string; label: string }[];
  /** Tipo de insumo a ser criado (slug TipoInsumo). Padrão: 'material'.
   *  Usar 'combustivel' quando o cadastro é feito a partir de um item de
   *  OC com destino = tanque de combustível. */
  tipoInsumo?: string;
  /** Chamado após salvar com sucesso — recebe o insumo criado pra vinculação */
  onCriado?: (insumo: Insumo) => void;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function InsumoQuickModal({
  open, onClose, nomeInicial = '', categorias, tipoInsumo = 'material', onCriado,
}: Props) {
  const ehCombustivel = tipoInsumo === 'combustivel' || tipoInsumo === 'combustível';
  const ehServico = tipoInsumo === 'servico' || tipoInsumo === 'mao de obra' || tipoInsumo === 'mao-de-obra';
  const { usuario } = useAuth();
  const adicionar = useAdicionarInsumo();
  const { data: unidades = [] } = useUnidades();

  const [nome, setNome] = useState(nomeInicial);
  const [unidade, setUnidade] = useState(
    ehCombustivel ? 'L' : ehServico ? 'serv' : 'un',
  );
  const [categoria, setCategoria] = useState<CategoriaMaterialCompra>(
    ehCombustivel ? 'combustivel'
      : ehServico ? 'servico'
      : (categorias[0]?.value ?? 'outros'),
  );
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reseta quando abre/fecha pra refletir o nome inicial mais novo
  // (mantemos lazy state com prop só na primeira renderização — usuário
  //  pode editar livremente depois)

  const podeSalvar = !!nome.trim() && !!unidade.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      const insumo: Insumo = {
        id: gerarId(),
        nome: nome.trim(),
        tipo: tipoInsumo, // 'material' ou 'combustivel' (forçado pelo destino)
        unidade: unidade.trim(),
        descricao: '',
        ativo: true,
        criadoPor: usuario?.nome ?? '',
        categoria,
        usadoEmManutencao: false,
      };
      await adicionar.mutateAsync(insumo);
      onCriado?.(insumo);
      // Limpa pro próximo uso
      setNome('');
      setUnidade('un');
      setCategoria(categorias[0]?.value ?? 'outros');
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar material');
    } finally {
      setSubmitting(false);
    }
  }

  const unidadeOptions = ehServico
    ? [
        { value: 'serv', label: 'serv — serviço (unidade)' },
        { value: 'h', label: 'h — hora' },
        { value: 'dia', label: 'dia — diária' },
        { value: 'TKM', label: 'TKM — tonelada × km (frete)' },
        { value: 'km', label: 'km — quilômetro' },
        { value: 'm', label: 'm — metro' },
        { value: 'm²', label: 'm² — metro quadrado' },
        { value: 'm³', label: 'm³ — metro cúbico' },
        ...unidades
          .map((u) => ({ value: u.sigla, label: `${u.sigla} — ${u.nome}` }))
          .filter((u) => !['serv', 'h', 'dia', 'TKM', 'km', 'm', 'm²', 'm³'].includes(u.value)),
      ]
    : [
        { value: 'un', label: 'un — unidade' },
        { value: 'kg', label: 'kg — quilograma' },
        { value: 'L', label: 'L — litro' },
        { value: 'm', label: 'm — metro' },
        { value: 'm²', label: 'm² — metro quadrado' },
        { value: 'm³', label: 'm³ — metro cúbico' },
        { value: 'pç', label: 'pç — peça' },
        { value: 'cx', label: 'cx — caixa' },
        { value: 'sc', label: 'sc — saco' },
        ...unidades
          .map((u) => ({ value: u.sigla, label: `${u.sigla} — ${u.nome}` }))
          .filter((u) => !['un', 'kg', 'L', 'm', 'm²', 'm³', 'pç', 'cx', 'sc'].includes(u.value)),
      ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        ehCombustivel ? 'Cadastro rápido de combustível'
          : ehServico ? 'Cadastro rápido de serviço (mão de obra)'
          : 'Cadastro rápido de material'
      }
      size="default"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[var(--color-fg-subtle)] -mt-1">
          Adicione o mínimo agora — você pode enriquecer o cadastro depois em <strong>Cadastros → Insumos</strong>.
        </p>
        {ehCombustivel && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
            Este insumo será criado como <strong>combustível</strong> e ficará disponível apenas em OCs para tanque.
          </div>
        )}
        {ehServico && (
          <div className="rounded-md border border-violet-200 bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-[11px] text-violet-800 dark:text-violet-200">
            Este insumo será criado como <strong>serviço/mão de obra</strong>. Vai aparecer em OCs que aceitam serviço (manutenção, sede, obra/etapa).
          </div>
        )}

        <Input
          label={
            ehCombustivel ? 'Nome do combustível'
              : ehServico ? 'Nome do serviço'
              : 'Nome do material'
          }
          required
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={
            ehCombustivel ? 'Ex.: Diesel S10'
              : ehServico ? 'Ex.: Mão de obra mecânico · Frete CBUQ TKM'
              : 'Ex.: Cimento CP-II 50kg'
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Unidade de medida"
            id="insumoQuickUnidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            options={unidadeOptions}
            required
          />
          <Select
            label="Categoria"
            id="insumoQuickCategoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            options={categorias.length > 0
              ? categorias
              : [{ value: 'outros', label: 'Outros' }]}
            required
          />
        </div>

        {erro && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting
              ? 'Salvando…'
              : ehCombustivel
                ? 'Cadastrar combustível'
                : ehServico
                  ? 'Cadastrar serviço'
                  : 'Cadastrar material'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
