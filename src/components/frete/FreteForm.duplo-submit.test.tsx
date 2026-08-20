/**
 * Regressão: duplo-clique no botão "Registrar Frete" não pode gravar duas vezes.
 *
 * Antes do fix, onValidSubmit chamava onSubmit() sem await, então o RHF nunca
 * setava isSubmitting e o botão só checava isValid — uma segunda batida rápida
 * disparava um segundo onSubmit (frete duplicado = caixa duplicado).
 *
 * O teste preenche TODOS os campos obrigatórios (selects via SmartSelect +
 * inputs de texto/número), clica uma vez, segura o submit em voo com uma
 * Promise controlável e prova que um segundo clique NÃO dispara outro onSubmit
 * (botão fica desabilitado mostrando "Salvando...").
 */
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import FreteForm from './FreteForm';
import type { Obra, Insumo, Localidade } from '../../types';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ temAcao: () => true }),
}));

vi.mock('../combustivel/AnexosUploader', () => ({
  default: () => null,
}));

const obras: Obra[] = [
  { id: 'obra-1', nome: 'Obra Teste', ativo: true } as Obra,
];
const insumos: Insumo[] = [
  { id: 'ins-1', nome: 'Brita', unidade: 't', ativo: true } as Insumo,
];
const localidades: Localidade[] = [
  { id: 'loc-1', nome: 'Pedreira Central', endereco: '', ativo: true, criadoPor: '' },
  { id: 'loc-2', nome: 'Obra Norte', endereco: '', ativo: true, criadoPor: '' },
];
const transportadoras = ['Andrade Transporte', 'Areacre'];

function renderForm(onSubmit: (data: unknown) => void | Promise<void>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FreteForm
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

/** Seleciona uma opção num SmartSelect identificado pelo nome acessível do botão. */
async function selecionar(user: ReturnType<typeof userEvent.setup>, nomeBotao: RegExp, opcao: string) {
  const botao = screen.getByRole('button', { name: nomeBotao });
  await user.click(botao);
  const lista = await screen.findByRole('listbox');
  await user.click(within(lista).getByText(opcao));
}

async function preencherCamposObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  // Input de data: fireEvent.change (jsdom não digita bem em type="date").
  fireEvent.change(screen.getByLabelText(/Data de Saída/i), { target: { value: '2026-06-03' } });
  // Inputs de texto/número (register)
  await user.type(screen.getByLabelText(/Motorista/i), 'João Silva');
  await user.type(screen.getByLabelText('Peso (toneladas)', { exact: false }), '25');
  await user.type(screen.getByLabelText(/KM Rodados/i), '100');
  await user.type(screen.getByLabelText(/Valor por T×KM/i), '0.15');
  // Campo opcional numérico: vazio vira NaN no register (valueAsNumber) e o zod
  // .nonnegative() reprova → isValid fica false. Preencher destrava o submit.
  await user.type(screen.getByLabelText(/Valor Unitário do Material/i), '45');

  // SmartSelects: o nome acessível do botão vem do <label htmlFor> associado.
  // O rótulo é "Obra" no frete de material e "Obra (opcional)" na
  // transferência — a obra só é dispensável nesta última.
  await selecionar(user, /^obra\b/i, 'Obra Teste');
  await selecionar(user, /^origem/i, 'Pedreira Central');
  await selecionar(user, /^destino/i, 'Obra Norte');
  await selecionar(user, /^transportadora/i, 'Andrade Transporte');
  await selecionar(user, /^material transportado/i, 'Brita');
}

describe('FreteForm — trava de duplo-submit', () => {
  it('dispara onSubmit uma única vez mesmo com duplo-clique', async () => {
    const user = userEvent.setup();

    let resolver: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((res) => { resolver = res; }));

    renderForm(onSubmit);
    await preencherCamposObrigatorios(user);

    const submit = screen.getByRole('button', { name: /Registrar Frete/i });
    await waitFor(() => expect(submit).toBeEnabled());

    // 1º clique — dispara o save (que fica pendurado na Promise controlável)
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Botão deve travar: desabilitado e mostrando "Salvando..."
    const salvando = await screen.findByRole('button', { name: /Salvando/i });
    expect(salvando).toBeDisabled();

    // 2º clique rápido — NÃO pode disparar um segundo onSubmit
    await user.click(salvando);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Libera o save em voo pra assentar o estado
    resolver();
  });
});
