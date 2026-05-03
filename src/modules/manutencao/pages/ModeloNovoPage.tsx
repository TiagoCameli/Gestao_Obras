import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import Card from '../../../components/ui/Card';
import { useAuth } from '../../../contexts/AuthContext';
import EquipamentoModeloForm from '../components/forms/EquipamentoModeloForm';
import { createEquipamentoModelo } from '../utils/equipamentoModelosApi';
import { ACOES_MANUTENCAO } from '../types';
import type { EquipamentoModelo } from '../types';

export default function ModeloNovoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { temAcao, usuario } = useAuth();
  const podeGerenciar = temAcao(ACOES_MANUTENCAO.gerenciar);

  if (!podeGerenciar) {
    return (
      <Card className="!p-5 text-sm text-[var(--color-fg-muted)]">
        Você não tem permissão para criar modelos.
      </Card>
    );
  }

  async function handleSubmit(data: EquipamentoModelo) {
    const comAutor = { ...data, criadoPor: usuario?.funcionarioId ?? data.criadoPor };
    const criado = await createEquipamentoModelo(comAutor);
    await qc.invalidateQueries({ queryKey: ['manutencao'] });
    navigate(`/manutencao/modelos/${criado.id}`);
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <nav aria-label="Breadcrumbs" className="flex items-center text-xs text-[var(--color-fg-muted)] gap-1">
        <Link to="/manutencao/modelos" className="hover:text-[var(--color-fg)] inline-flex items-center gap-1">
          <ArrowLeft aria-hidden className="w-3.5 h-3.5" />
          Modelos
        </Link>
        <ChevronRight aria-hidden className="w-3.5 h-3.5" />
        <span className="text-[var(--color-fg)] font-medium">Novo</span>
      </nav>

      <h2 className="text-lg font-semibold text-[var(--color-fg)]">Novo modelo</h2>

      <EquipamentoModeloForm
        modo="criar"
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

export { ModeloNovoPage };
