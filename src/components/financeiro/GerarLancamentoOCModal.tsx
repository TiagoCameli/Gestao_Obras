/**
 * GerarLancamentoOCModal — Gera lançamento financeiro a partir de uma OC
 * aprovada. Reusa o `LancamentoFinanceiroForm` em modo `oc` (travado).
 *
 * O lançamento é pré-preenchido por `lancamentoFromOC` (header + rateio
 * agregado dos blocos da OC + parcelas da OC + categoria sugerida).
 * Usuário só precisa revisar/ajustar: forma de pagamento, parcelas
 * (se quiser refinar), anexos. Tudo o resto fica travado.
 */
import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useDirtyFormGuard } from '../ui/DirtyFormGuard';
import LancamentoFinanceiroForm from './LancamentoFinanceiroForm';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useEmpresas } from '../../hooks/useEmpresas';
import { useObras } from '../../hooks/useObras';
import { useEtapas } from '../../hooks/useEtapas';
import { useOrdensServico } from '../../hooks/useOrdensServico';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useCategoriasFinanceiras } from '../../hooks/useCategoriasFinanceiras';
import {
  useLancamentosFinanceiros,
  useAdicionarLancamentoFinanceiro,
} from '../../hooks/useLancamentosFinanceiros';
import { useToast } from '../ui/Toast';
import { lancamentoFromOC, sugerirCategoriaFromOC } from '../../utils/lancamentoFromOC';
import { proximoNumeroPorAno } from '../../utils/comprasNumero';
import type { OrdemCompra, LancamentoFinanceiro } from '../../types';

interface Props {
  open: boolean;
  oc: OrdemCompra | null;
  onClose: () => void;
  /** Callback opcional após criar lançamento — usado pra fechar drawer/lista. */
  onGerado?: (lanc: LancamentoFinanceiro) => void;
}

export default function GerarLancamentoOCModal({ open, oc, onClose, onGerado }: Props) {
  const { showToast } = useToast();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: empresas = [] } = useEmpresas();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: ordensServico = [] } = useOrdensServico();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: categorias = [] } = useCategoriasFinanceiras();
  const { data: lancamentos = [] } = useLancamentosFinanceiros();
  const addMut = useAdicionarLancamentoFinanceiro();
  const [dirty, setDirty] = useState(false);
  const doClose = () => { setDirty(false); onClose(); };
  const guard = useDirtyFormGuard({ dirty, onClose: doClose });

  // Constrói o lançamento pré-preenchido a partir da OC (memoizado pelo id).
  const initial = useMemo<LancamentoFinanceiro | null>(() => {
    if (!oc) return null;
    const proxNumero = proximoNumeroPorAno('LF', lancamentos.map((l) => l.numero));
    const categoriaSugerida = sugerirCategoriaFromOC(oc, categorias);
    // empresaPagadoraId: tenta achar pela string `empresaFaturamento` da OC
    const empresaPagadora = empresas.find((e) => e.nome === oc.empresaFaturamento);
    return lancamentoFromOC(oc, {
      proximoNumero: proxNumero,
      categoriaIdSugerida: categoriaSugerida,
      empresaPagadoraId: empresaPagadora?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc?.id, lancamentos.length, categorias.length, empresas.length]);

  if (!oc) return null;

  async function handleSubmit(lanc: LancamentoFinanceiro) {
    try {
      await addMut.mutateAsync(lanc);
      showToast({ kind: 'success', message: `Lançamento ${lanc.numero} gerado a partir da OC ${oc?.numero}.` });
      onGerado?.(lanc);
      setDirty(false);
      onClose();
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao gerar lançamento.',
      });
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={doClose}
        onClosePending={guard.onClosePending}
        title={`Gerar lançamento financeiro · OC ${oc.numero}`}
        size="xl"
      >
        {initial && (
          <LancamentoFinanceiroForm
            initial={initial}
            modo="oc"
            fornecedores={fornecedores}
            empresas={empresas}
            obras={obras}
            etapas={etapas}
            ordensServico={ordensServico}
            equipamentos={equipamentos}
            categorias={categorias}
            proximoNumero={initial.numero}
            onSubmit={handleSubmit}
            onCancel={guard.tryClose}
            onCreateFornecedor={async () => {
              showToast({ kind: 'info', message: 'Fornecedor da OC já está vinculado.' });
              return '';
            }}
            onDirtyChange={setDirty}
          />
        )}
      </Modal>
      {guard.dialog}
    </>
  );
}
