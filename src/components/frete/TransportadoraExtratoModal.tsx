// Wrapper sobre Modal pra abrir o extrato de uma transportadora específica.
// Carrega os movimentos via useTransportadoraMovimentos quando abre.

import Modal from '../ui/Modal';
import TransportadoraExtratoList from './TransportadoraExtratoList';
import { useTransportadoraMovimentos } from '../../hooks/useTransportadoraMovimentos';
import { useTransportadoraSaldo } from '../../hooks/useTransportadoraSaldo';

interface Props {
  open: boolean;
  onClose: () => void;
  transportadoraId: string | null;
  transportadoraNome: string | null;
  canExport?: boolean;
}

export default function TransportadoraExtratoModal({
  open,
  onClose,
  transportadoraId,
  transportadoraNome,
  canExport = true,
}: Props) {
  // Hooks sempre chamados — controlam loading via enabled na implementação.
  const { data: movimentos = [], isLoading: loadingMovs } = useTransportadoraMovimentos({
    transportadoraId: transportadoraId ?? undefined,
  });
  const { data: saldo, isLoading: loadingSaldo } = useTransportadoraSaldo(transportadoraId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transportadoraNome ? `Extrato — ${transportadoraNome}` : 'Extrato'}
      size="xl"
    >
      {!transportadoraId ? (
        <div className="text-center text-sm text-gray-500 py-8">
          Selecione uma transportadora pra ver o extrato.
        </div>
      ) : loadingMovs || loadingSaldo ? (
        <div className="text-center text-sm text-gray-500 py-8">
          Carregando extrato...
        </div>
      ) : (
        <TransportadoraExtratoList
          transportadoraNome={transportadoraNome ?? '?'}
          movimentos={movimentos}
          saldoAtual={saldo?.saldo ?? 0}
          canExport={canExport}
        />
      )}
    </Modal>
  );
}
