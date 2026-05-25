/**
 * Financeiro v1 — Contas a Pagar (rota raiz `/financeiro`).
 *
 * Esqueleto da página com 4 abas (Visão Geral, Lançamentos, Contas a Pagar,
 * Categorias). As implementações de cada aba virão nas fases seguintes
 * (F4-F10); aqui ficam só os placeholders pra a rota poder ser navegada.
 *
 * O padrão de tabs via search-params replica o `Compras.tsx` pra que
 * voltar/atalho de URL funcione (ex: /financeiro?tab=contas).
 */
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/shadcn/tabs';
import CategoriasList from '../components/financeiro/CategoriasList';
import LancamentosList from '../components/financeiro/LancamentosList';
import VisaoGeralFinanceiro from '../components/financeiro/VisaoGeralFinanceiro';
import LancamentoFinanceiroForm from '../components/financeiro/LancamentoFinanceiroForm';
import LancamentoDetalheDrawer from '../components/financeiro/LancamentoDetalheDrawer';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { useFornecedores } from '../hooks/useFornecedores';
import { useEmpresas } from '../hooks/useEmpresas';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useOrdensServico } from '../hooks/useOrdensServico';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useCategoriasFinanceiras } from '../hooks/useCategoriasFinanceiras';
import {
  useLancamentosFinanceiros,
  useAdicionarLancamentoFinanceiro,
  useAtualizarLancamentoFinanceiro,
  useFecharLancamentoFinanceiro,
  useReabrirLancamentoFinanceiro,
  useExcluirLancamentoFinanceiro,
} from '../hooks/useLancamentosFinanceiros';
import { proximoNumeroPorAno } from '../utils/comprasNumero';
import { useAuth } from '../contexts/AuthContext';
import type { LancamentoFinanceiro } from '../types';

type Tab = 'visao' | 'lancamentos' | 'contas' | 'categorias';

const tabs: { key: Tab; label: string }[] = [
  { key: 'visao', label: 'Visão Geral' },
  { key: 'lancamentos', label: 'Lançamentos' },
  { key: 'contas', label: 'Contas a Pagar' },
  { key: 'categorias', label: 'Categorias' },
];

export default function Financeiro() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: Tab[] = ['visao', 'lancamentos', 'contas', 'categorias'];
  const tabParam = searchParams.get('tab') as Tab | null;
  const tab: Tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'visao';
  const setTab = useCallback(
    (t: Tab) => setSearchParams({ tab: t }, { replace: true }),
    [setSearchParams],
  );

  const { temAcao } = useAuth();
  const podeCriar = temAcao('criar_lancamento_financeiro');
  const { showToast } = useToast();

  // Data sources
  const { data: lancamentos = [] } = useLancamentosFinanceiros();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: empresas = [] } = useEmpresas();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: ordensServico = [] } = useOrdensServico();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: categorias = [] } = useCategoriasFinanceiras();
  const addMut = useAdicionarLancamentoFinanceiro();
  const updMut = useAtualizarLancamentoFinanceiro();
  const fecharMut = useFecharLancamentoFinanceiro();
  const reabrirMut = useReabrirLancamentoFinanceiro();
  const excluirMut = useExcluirLancamentoFinanceiro();
  const podeEditar = temAcao('editar_lancamento_financeiro');
  const podeFechar = temAcao('fechar_lancamento_financeiro');
  const podeReabrir = temAcao('reabrir_lancamento_financeiro');
  const podeExcluir = temAcao('excluir_lancamento_financeiro');

  // Modal de Novo Lançamento Avulso (e edição: mesmo modal, `editandoLanc` controla)
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [editandoLanc, setEditandoLanc] = useState<LancamentoFinanceiro | null>(null);
  const [formDirty, setFormDirty] = useState(false);
  // Drawer de detalhes (visualização) — abre ao clicar numa linha da lista
  const [detalheLanc, setDetalheLanc] = useState<LancamentoFinanceiro | null>(null);
  // Mantém referência fresca quando a query do React Query reidrata o array
  const detalheLancFresco = detalheLanc
    ? (lancamentos.find((x) => x.id === detalheLanc.id) ?? detalheLanc)
    : null;
  const proxNumero = proximoNumeroPorAno('LF', lancamentos.map((l) => l.numero));

  async function handleSubmitForm(lanc: LancamentoFinanceiro) {
    try {
      if (editandoLanc) {
        await updMut.mutateAsync(lanc);
        showToast({ kind: 'success', message: `Lançamento ${lanc.numero} atualizado.` });
      } else {
        await addMut.mutateAsync(lanc);
        showToast({ kind: 'success', message: `Lançamento ${lanc.numero} criado.` });
      }
      setNovoModalOpen(false);
      setEditandoLanc(null);
      setFormDirty(false);
    } catch (err) {
      showToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar.',
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Lançamentos a partir de OC ou avulsos · parcelas · pagamentos · rateio de custos por obra/manutenção/sede"
        actions={podeCriar && (
          <Button onClick={() => setNovoModalOpen(true)}>
            <Plus className="w-4 h-4" /> Novo lançamento
          </Button>
        )}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <TabsList
          variant="line"
          aria-label="Financeiro tabs"
          className="mb-6 w-full justify-start border-b border-[var(--color-border)] rounded-none px-0 h-auto overflow-x-auto [&_[data-slot=tabs-trigger]]:data-active:after:bg-[var(--color-accent)] [&_[data-slot=tabs-trigger]]:data-active:text-[var(--color-fg)] [&_[data-slot=tabs-trigger]]:data-active:font-semibold"
        >
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="visao" className="mt-0">
          <VisaoGeralFinanceiro lancamentos={lancamentos} fornecedores={fornecedores} />
        </TabsContent>

        <TabsContent value="lancamentos" className="mt-0">
          <LancamentosList
            lancamentos={lancamentos}
            fornecedores={fornecedores}
            empresas={empresas}
            categorias={categorias}
            modo="todos"
            onEditar={(l) => { setEditandoLanc(l); setNovoModalOpen(true); }}
            onVerDetalhes={(l) => setDetalheLanc(l)}
          />
        </TabsContent>

        <TabsContent value="contas" className="mt-0">
          <LancamentosList
            lancamentos={lancamentos}
            fornecedores={fornecedores}
            empresas={empresas}
            categorias={categorias}
            modo="contas_pagar"
            onEditar={(l) => { setEditandoLanc(l); setNovoModalOpen(true); }}
            onVerDetalhes={(l) => setDetalheLanc(l)}
          />
        </TabsContent>

        <TabsContent value="categorias" className="mt-0">
          <CategoriasList />
        </TabsContent>
      </Tabs>

      {/* Modal Novo/Editar Lançamento — reusa o mesmo form. Quando `editandoLanc`
          é null, é criação avulsa; quando preenchido, é edição. Lançamento
          vindo de OC mantém modo='oc' (travado). */}
      <Modal
        open={novoModalOpen}
        onClose={() => { setNovoModalOpen(false); setEditandoLanc(null); setFormDirty(false); }}
        confirmClose={() => {
          if (formDirty) {
            return window.confirm('Você tem alterações não salvas. Sair mesmo assim?');
          }
          return true;
        }}
        title={editandoLanc ? `Editar lançamento ${editandoLanc.numero}` : 'Novo lançamento financeiro'}
        size="xl"
      >
        <LancamentoFinanceiroForm
          initial={editandoLanc}
          modo={editandoLanc?.origem === 'oc' ? 'oc' : 'avulso'}
          fornecedores={fornecedores}
          empresas={empresas}
          obras={obras}
          etapas={etapas}
          ordensServico={ordensServico}
          equipamentos={equipamentos}
          categorias={categorias}
          proximoNumero={editandoLanc?.numero ?? proxNumero}
          onSubmit={handleSubmitForm}
          onCancel={() => {
            if (formDirty && !window.confirm('Você tem alterações não salvas. Sair mesmo assim?')) return;
            setNovoModalOpen(false);
            setEditandoLanc(null);
            setFormDirty(false);
          }}
          onCreateFornecedor={async () => {
            showToast({ kind: 'info', message: 'Cadastre o fornecedor em Cadastros > Fornecedores antes.' });
            return '';
          }}
          onDirtyChange={setFormDirty}
        />
      </Modal>

      {/* Drawer de detalhes do lançamento (abre ao clicar numa linha da lista) */}
      <LancamentoDetalheDrawer
        open={!!detalheLancFresco}
        onClose={() => setDetalheLanc(null)}
        lancamento={detalheLancFresco}
        fornecedores={fornecedores}
        empresas={empresas}
        categorias={categorias}
        obras={obras}
        etapas={etapas}
        ordensServico={ordensServico}
        equipamentos={equipamentos}
        onEditar={podeEditar && detalheLancFresco && !detalheLancFresco.fechado
          ? () => {
              const l = detalheLancFresco;
              setDetalheLanc(null);
              if (l) { setEditandoLanc(l); setNovoModalOpen(true); }
            }
          : undefined}
        onFechar={podeFechar && detalheLancFresco && !detalheLancFresco.fechado
          ? async () => {
              if (!detalheLancFresco) return;
              if (!window.confirm(`Fechar lançamento ${detalheLancFresco.numero}? Edição fica travada — pagamentos continuam permitidos.`)) return;
              try {
                await fecharMut.mutateAsync(detalheLancFresco.id);
                showToast({ kind: 'success', message: `Lançamento fechado.` });
              } catch (err) {
                showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
              }
            }
          : undefined}
        onReabrir={podeReabrir && detalheLancFresco?.fechado
          ? async () => {
              if (!detalheLancFresco) return;
              if (!window.confirm(`Reabrir lançamento ${detalheLancFresco.numero}? Edição volta a ficar liberada.`)) return;
              try {
                await reabrirMut.mutateAsync(detalheLancFresco.id);
                showToast({ kind: 'success', message: `Lançamento reaberto.` });
              } catch (err) {
                showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
              }
            }
          : undefined}
        onExcluir={podeExcluir && detalheLancFresco && !detalheLancFresco.fechado
          ? async () => {
              if (!detalheLancFresco) return;
              if (!window.confirm(`Excluir lançamento ${detalheLancFresco.numero}? Esta ação é soft-delete e pode ser revertida via banco.`)) return;
              try {
                await excluirMut.mutateAsync(detalheLancFresco);
                showToast({ kind: 'success', message: `Lançamento excluído.` });
                setDetalheLanc(null);
              } catch (err) {
                showToast({ kind: 'error', message: err instanceof Error ? err.message : 'Erro.' });
              }
            }
          : undefined}
      />
    </div>
  );
}

