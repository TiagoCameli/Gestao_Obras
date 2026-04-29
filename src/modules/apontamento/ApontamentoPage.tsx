import { useState } from "react";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import FuncionarioForm from "./components/FuncionarioForm";
import FuncionarioList from "./components/FuncionarioList";
import AlocacaoTab from "./components/AlocacaoTab";
import RegistroPontoTab from "./components/RegistroPontoTab";
import ApontamentoServicoTab from "./components/ApontamentoServicoTab";
import DashboardTab from "./components/DashboardTab";
import HistoricoTab from "./components/HistoricoTab";
import {
  useCreateFuncionario,
  useDeleteFuncionario,
  useFuncionarios,
  useUpdateFuncionario,
} from "./hooks/useApontamentoData";
import type { Funcionario } from "./types/funcionario";

type Tab = "dashboard" | "funcionarios" | "alocacao" | "ponto" | "servico" | "historico";

export default function ApontamentoPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">
            Apontamento
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)]">
            Cadastro de funcionários, registro de ponto e apontamento por serviço.
          </p>
        </div>
        {tab === "funcionarios" && (
          <Button onClick={() => setModal({ open: true, edit: null })}>
            Novo funcionário
          </Button>
        )}
      </header>

      <nav className="flex gap-1 border-b border-[var(--color-border)] overflow-x-auto">
        <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Dashboard
        </TabBtn>
        <TabBtn active={tab === "funcionarios"} onClick={() => setTab("funcionarios")}>
          Funcionários
        </TabBtn>
        <TabBtn active={tab === "alocacao"} onClick={() => setTab("alocacao")}>
          Alocação
        </TabBtn>
        <TabBtn active={tab === "ponto"} onClick={() => setTab("ponto")}>
          Registro de Ponto
        </TabBtn>
        <TabBtn active={tab === "servico"} onClick={() => setTab("servico")}>
          Apontamento por Serviço
        </TabBtn>
        <TabBtn active={tab === "historico"} onClick={() => setTab("historico")}>
          Histórico
        </TabBtn>
      </nav>

      {tab === "dashboard" && <DashboardTab />}

      {tab === "funcionarios" && (
        <>
          {isLoading ? (
            <div className="py-12 text-center text-[var(--color-fg-subtle)]">
              Carregando...
            </div>
          ) : (
            <FuncionarioList
              funcionarios={funcionarios}
              onEdit={(f) => setModal({ open: true, edit: f })}
              onDelete={(id) => setDeleteId(id)}
            />
          )}
        </>
      )}

      {tab === "alocacao" && <AlocacaoTab />}

      {tab === "ponto" && <RegistroPontoTab />}

      {tab === "servico" && <ApontamentoServicoTab />}

      {tab === "historico" && <HistoricoTab />}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, edit: null })}
        title={modal.edit ? "Editar funcionário" : "Novo funcionário"}
        size="lg"
      >
        <FuncionarioForm
          initial={modal.edit}
          onSubmit={handleSubmit}
          onSaved={() => setModal({ open: false, edit: null })}
          onCancel={() => setModal({ open: false, edit: null })}
        />
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await remove.mutateAsync(deleteId);
          setDeleteId(null);
        }}
        title="Excluir funcionário"
        message="Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita."
      />
    </div>
  );
}

function TabBtn({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
        (active
          ? "border-[var(--color-accent)] text-[var(--color-fg)]"
          : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]") +
        (disabled ? " opacity-50 cursor-not-allowed" : "")
      }
    >
      {children}
    </button>
  );
}
