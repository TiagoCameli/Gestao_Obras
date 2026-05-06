// Wrapper sobre Modal pra abrir o extrato de uma transportadora específica.
// Carrega os movimentos via useTransportadoraMovimentos quando abre.

import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import TransportadoraExtratoList from './TransportadoraExtratoList';
import AjusteManualTransportadoraForm from './AjusteManualTransportadoraForm';
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
  const [ajusteOpen, setAjusteOpen] = useState(false);

  return (
    <>
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
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setAjusteOpen(true)} className="text-sm">
                + Novo Ajuste Manual
              </Button>
            </div>
            <TransportadoraExtratoList
              transportadoraNome={transportadoraNome ?? '?'}
              movimentos={movimentos}
              saldoAtual={saldo?.saldo ?? 0}
              canExport={canExport}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={ajusteOpen && !!transportadoraId}
        onClose={() => setAjusteOpen(false)}
        title={`Ajuste Manual — ${transportadoraNome ?? '?'}`}
        size="lg"
      >
        {transportadoraId && (
          <AjusteManualTransportadoraForm
            transportadoraId={transportadoraId}
            transportadoraNome={transportadoraNome ?? '?'}
            onSuccess={() => setAjusteOpen(false)}
            onCancel={() => setAjusteOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}
