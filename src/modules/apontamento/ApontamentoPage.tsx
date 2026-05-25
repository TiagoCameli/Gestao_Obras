import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Drawer from "../../components/ui/Drawer";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import LoadingState from "../../components/ui/LoadingState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/shadcn/tabs";
import FuncionarioForm from "./components/FuncionarioForm";
import FuncionarioList from "./components/FuncionarioList";
import AlocacaoTab from "./components/AlocacaoTab";
import RegistroPontoTab from "./components/RegistroPontoTab";
import ApontamentoServicoTab from "./components/ApontamentoServicoTab";
import DashboardTab from "./components/DashboardTab";
import HistoricoTab from "./components/HistoricoTab";
import AprovacaoTab from "./components/AprovacaoTab";
import { useAuth } from "../../contexts/AuthContext";
import {
  useCreateFuncionario,
  useDeleteFuncionario,
  useFuncionarios,
  useUpdateFuncionario,
} from "./hooks/useApontamentoData";
import type { Funcionario } from "./types/funcionario";

type Tab = "dashboard" | "funcionarios" | "alocacao" | "ponto" | "servico" | "aprovacao" | "historico";
const VALID_TABS: Tab[] = ["dashboard", "funcionarios", "alocacao", "ponto", "servico", "aprovacao", "historico"];

export default function ApontamentoPage() {
  const { temAcao } = useAuth();
  // Permissões de aba (admin pode controlar por usuário em Cadastros → Usuários)
  const canDashboard = temAcao("aba_rh_dashboard");
  const canFuncionarios = temAcao("aba_rh_funcionarios");
  const canAlocacao = temAcao("aba_rh_alocacao");
  const canPonto = temAcao("aba_rh_ponto");
  const canServico = temAcao("aba_rh_servico");
  const canAprovacao = temAcao("aba_rh_aprovacao") && temAcao("ver_aprovacoes_rh");
  const canHistorico = temAcao("aba_rh_historico");

  const tabsPermitidas: Tab[] = [
    canDashboard ? ("dashboard" as Tab) : null,
    canFuncionarios ? ("funcionarios" as Tab) : null,
    canAlocacao ? ("alocacao" as Tab) : null,
    canPonto ? ("ponto" as Tab) : null,
    canServico ? ("servico" as Tab) : null,
    canAprovacao ? ("aprovacao" as Tab) : null,
    canHistorico ? ("historico" as Tab) : null,
  ].filter((x): x is Tab => x !== null);

  // Persiste a aba ativa em ?tab= pra sobreviver a refresh / link direto.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && VALID_TABS.includes(tabParam) && tabsPermitidas.includes(tabParam)
    ? tabParam
    : (tabsPermitidas[0] ?? "dashboard");
  const setTab = useCallback(
    (t: Tab) => setSearchParams({ tab: t }, { replace: true }),
    [setSearchParams]
  );
  const { data: funcionarios = [], isLoading } = useFuncionarios();
  const create = useCreateFuncionario();
  const update = useUpdateFuncionario();
  const remove = useDeleteFuncionario();

  const [modal, setModal] = useState<{ open: boolean; edit: Funcionario | null }>(
    { open: false, edit: null }
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function handleSubmit(
    f: Omit<Funcionario, "createdAt" | "updatedAt">
  ): Promise<Funcionario> {
    // O form pré-gera id (uuid v4) pra novos cadastros, então decidimos
    // create/update pelo `modal.edit` em vez do `f.id`.
    if (modal.edit) {
      return update.mutateAsync(f as Funcionario);
    }
    return create.mutateAsync(f);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apontamento"
        description="Cadastro de funcionários, registro de ponto e apontamento por serviço."
        actions={tab === "funcionarios" && (
          <Button onClick={() => setModal({ open: true, edit: null })}>
            Novo funcionário
          </Button>
        )}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
        <TabsList
          variant="line"
          className="mb-6 w-full justify-start border-b border-[var(--color-border)] rounded-none px-0 h-auto overflow-x-auto [&_[data-slot=tabs-trigger]]:data-active:after:bg-[var(--color-accent)] [&_[data-slot=tabs-trigger]]:data-active:text-[var(--color-fg)] [&_[data-slot=tabs-trigger]]:data-active:font-semibold"
        >
          {canDashboard && <TabsTrigger value="dashboard">Dashboard</TabsTrigger>}
          {canFuncionarios && <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>}
          {canAlocacao && <TabsTrigger value="alocacao">Alocação</TabsTrigger>}
          {canPonto && <TabsTrigger value="ponto">Registro de Ponto</TabsTrigger>}
          {canServico && <TabsTrigger value="servico">Apontamento por Serviço</TabsTrigger>}
          {canAprovacao && <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>}
          {canHistorico && <TabsTrigger value="historico">Histórico</TabsTrigger>}
        </TabsList>

        {canDashboard && <TabsContent value="dashboard" className="mt-0"><DashboardTab /></TabsContent>}

        {canFuncionarios && (
          <TabsContent value="funcionarios" className="mt-0">
            {isLoading ? (
              <LoadingState mode="list" count={6} />
            ) : (
              <FuncionarioList
                funcionarios={funcionarios}
                onEdit={(f) => setModal({ open: true, edit: f })}
                onDelete={(id) => setDeleteId(id)}
              />
            )}
          </TabsContent>
        )}

        {canAlocacao && <TabsContent value="alocacao" className="mt-0"><AlocacaoTab /></TabsContent>}
        {canPonto && <TabsContent value="ponto" className="mt-0"><RegistroPontoTab /></TabsContent>}
        {canServico && <TabsContent value="servico" className="mt-0"><ApontamentoServicoTab /></TabsContent>}
        {canAprovacao && <TabsContent value="aprovacao" className="mt-0"><AprovacaoTab /></TabsContent>}
        {canHistorico && <TabsContent value="historico" className="mt-0"><HistoricoTab /></TabsContent>}
      </Tabs>

      <Drawer
        open={modal.open}
        onClose={() => setModal({ open: false, edit: null })}
        title={modal.edit ? "Editar funcionário" : "Novo funcionário"}
        subtitle={modal.edit ? modal.edit.nome : undefined}
        width="xl"
      >
        <FuncionarioForm
          // Drawer mantém children montados sempre — sem `key` o useState
          // do form preserva valores do funcionário anterior ao trocar de
          // editar→novo ou editar→outro funcionário.
          key={modal.edit?.id ?? "new"}
          initial={modal.edit}
          onSubmit={handleSubmit}
          onSaved={() => setModal({ open: false, edit: null })}
          onCancel={() => setModal({ open: false, edit: null })}
        />
      </Drawer>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await remove.mutateAsync(deleteId);
          setDeleteId(null);
        }}
        title="Excluir funcionário"
        message="Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita."
        requirePassword={false}
      />
    </div>
  );
}
