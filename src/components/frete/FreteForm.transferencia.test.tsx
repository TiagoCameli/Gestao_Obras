/**
 * Frete de transferência de material.
 *
 * A transferência move material que a EMT já tem. Ela pergunta menos coisa que
 * o frete de pedreira (sem NF, sem valor de material, obra opcional) e o
 * payload dela NÃO pode carregar valor de material — é isso que mantém o
 * "Saldo na Pedreira" intacto.
 */
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import FreteForm from './FreteForm';
import type { Frete, Obra, Insumo, Localidade } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ temAcao: () => true }),
}));
vi.mock('../combustivel/AnexosUploader', () => ({ default: () => null }));

const obras: Obra[] = [{ id: 'obra-1', nome: 'Obra Teste', ativo: true } as Obra];
const insumos: Insumo[] = [{ id: 'ins-1', nome: 'Brita', unidade: 't', ativo: true } as Insumo];
const localidades: Localidade[] = [
  { id: 'loc-1', nome: 'Patio da Usina', endereco: '', ativo: true, criadoPor: '' },
  { id: 'loc-2', nome: 'Frente 3', endereco: '', ativo: true, criadoPor: '' },
];
const transportadoras = ['Andrade Transporte', 'Areacre'];

function renderForm(
  onSubmit: (data: unknown) => void | Promise<void>,
  tipo: 'material' | 'transferencia',
  initial?: Frete | null,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FreteForm
        initial={initial}
        tipo={tipo}
        onSubmit={onSubmit as (data: never) => void}
        onCancel={() => {}}
        obras={obras}
        insumos={insumos}
        localidades={localidades}
        transportadoras={transportadoras}
      />
    </QueryClientProvider>,
  );
}

async function selecionar(user: ReturnType<typeof userEvent.setup>, nomeBotao: RegExp, opcao: string) {
  await user.click(screen.getByRole('button', { name: nomeBotao }));
  const lista = await screen.findByRole('listbox');
  await user.click(within(lista).getByText(opcao));
}

/** Preenche exatamente os 9 campos que a transferência pergunta. */
async function preencherTransferencia(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByLabelText(/Data de Saída/i), { target: { value: '2026-08-20' } });
  await user.type(screen.getByLabelText(/Motorista/i), 'João Silva');
  await user.type(screen.getByLabelText('Peso (toneladas)', { exact: false }), '30');
  await user.type(screen.getByLabelText(/Distância \(KM\)/i), '40');
  await user.type(screen.getByLabelText(/Valor por T×KM/i), '0.5');
  await user.type(screen.getByLabelText(/Placa da Carreta/i), 'ABC-1D34');
  await selecionar(user, /^de \(origem\)/i, 'Patio da Usina');
  await selecionar(user, /^para \(destino\)/i, 'Frente 3');
  await selecionar(user, /^transportadora/i, 'Andrade Transporte');
  await selecionar(user, /^material transportado/i, 'Brita');
}

describe('FreteForm — modo transferência', () => {
  it('não mostra nota fiscal nem valor de material', () => {
    renderForm(() => {}, 'transferencia');
    expect(screen.queryByLabelText(/Nota Fiscal \(opcional\)/i)).toBeNull();
    expect(screen.queryByLabelText(/Nota Fiscal 2/i)).toBeNull();
    expect(screen.queryByLabelText(/Valor Unitário do Material/i)).toBeNull();
    expect(screen.queryByText(/Preço do Material/i)).toBeNull();
  });

  it('mostra esses campos no frete de material (linha de controle)', () => {
    renderForm(() => {}, 'material');
    expect(screen.getByLabelText(/Nota Fiscal \(opcional\)/i)).toBeTruthy();
    expect(screen.getByLabelText(/Valor Unitário do Material/i)).toBeTruthy();
  });

  it('avisa que não desconta saldo de pedreira', () => {
    renderForm(() => {}, 'transferencia');
    expect(screen.getByText(/não desconta saldo de pedreira/i)).toBeTruthy();
  });

  it('grava tipo=transferencia, valor de material zerado e NF vazia — sem obra', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderForm(onSubmit, 'transferencia');

    await preencherTransferencia(user);

    const submit = screen.getByRole('button', { name: /Registrar Transferência/i });
    await waitFor(() => expect(submit).toBeEnabled()); // prova que obra não trava
    await user.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0] as Frete;

    expect(payload.tipo).toBe('transferencia');
    expect(payload.origem).toBe('Patio da Usina');
    expect(payload.destino).toBe('Frente 3');
    expect(payload.obraId).toBe('');
    expect(payload.valorMaterial).toBe(0);
    expect(payload.notaFiscal).toBe('');
    expect(payload.notaFiscal2).toBe('');
    // Linha de controle: o crédito da transportadora TEM que sair certo,
    // senão o teste passaria com um payload zerado por inteiro.
    expect(payload.valorTotal).toBeCloseTo(30 * 40 * 0.5, 6); // R$ 600,00
    expect(payload.placaCarreta).toBe('ABC-1D34');
    expect(payload.motorista).toBe('João Silva');
  });

  it('editar uma transferência mantém o tipo, mesmo com o prop pedindo material', () => {
    // O prop `tipo` só vale na criação. Converter um frete de material em
    // transferência pela tela mudaria o saldo de uma pedreira sem rastro.
    const gravada = {
      id: 'f1', tipo: 'transferencia', data: '2026-08-20', dataChegada: '', obraId: '',
      origem: 'Patio da Usina', destino: 'Frente 3', transportadora: 'Andrade Transporte',
      insumoId: 'ins-1', pesoToneladas: 30, kmRodados: 40, valorTkm: 0.5, valorTotal: 600,
      notaFiscal: '', notaFiscal2: '', placaCarreta: 'ABC-1D34', motorista: 'João Silva',
      valorMaterial: 0, observacoes: '', criadoPor: '',
    } as Frete;

    renderForm(() => {}, 'material', gravada);
    expect(screen.getByText(/não desconta saldo de pedreira/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Valor Unitário do Material/i)).toBeNull();
  });
});
