/**
 * Regressão: os dropdowns (Select -> SmartSelect, controlado) precisam refletir
 * a opção selecionada no display. Antes do fix estavam ligados com
 * {...register()}, que não devolve `value` pro SmartSelect, então selecionar
 * "não fazia nada" visualmente.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PagamentoFreteForm from './PagamentoFreteForm';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ temAcao: () => true }),
}));

vi.mock('../combustivel/AnexosUploader', () => ({
  default: () => null,
}));

function setup() {
  const onSubmit = vi.fn();
  render(
    <PagamentoFreteForm
      onSubmit={onSubmit}
      onCancel={() => {}}
      transportadoras={['Andrade Transporte', 'Areacre', 'Britam']}
      funcionarios={[]}
      fornecedores={[]}
      nomeUsuario="Tiago"
    />,
  );
  return { onSubmit };
}

describe('PagamentoFreteForm — dropdowns controlados', () => {
  it('reflete a transportadora selecionada no botão do dropdown', async () => {
    const user = userEvent.setup();
    setup();

    // O nome acessível do botão é o label ("Transportadora *").
    const botao = screen.getByRole('button', { name: /transportadora/i });
    expect(botao).toHaveTextContent(/selecione a transportadora/i);

    await user.click(botao);
    const lista = screen.getByRole('listbox');
    await user.click(within(lista).getByText('Areacre'));

    // Após selecionar, o botão precisa mostrar "Areacre" (não mais o placeholder).
    expect(botao).toHaveTextContent('Areacre');
  });

  it('reflete o método de pagamento selecionado', async () => {
    const user = userEvent.setup();
    setup();

    const botaoMetodo = screen.getByRole('button', { name: /método de pagamento/i });
    expect(botaoMetodo).toHaveTextContent(/pix/i); // default

    await user.click(botaoMetodo);
    const lista = screen.getByRole('listbox');
    await user.click(within(lista).getByText('Boleto'));

    expect(botaoMetodo).toHaveTextContent(/boleto/i);
  });
});
