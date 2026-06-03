import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SubmitButton from './SubmitButton';

describe('SubmitButton', () => {
  it('mostra o label normal e fica habilitado quando não está carregando', () => {
    render(<SubmitButton loading={false}>Registrar Frete</SubmitButton>);
    const btn = screen.getByRole('button', { name: /registrar frete/i });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute('type', 'submit');
  });

  it('fica desabilitado e mostra "Salvando..." quando loading=true', () => {
    render(<SubmitButton loading>Registrar Frete</SubmitButton>);
    const btn = screen.getByRole('button', { name: /salvando/i });
    expect(btn).toBeDisabled();
  });

  it('respeita disabled recebido por prop quando não está carregando', () => {
    render(<SubmitButton loading={false} disabled>Salvar</SubmitButton>);
    expect(screen.getByRole('button', { name: /salvar/i })).toBeDisabled();
  });

  it('usa loadingLabel customizado', () => {
    render(<SubmitButton loading loadingLabel="Enviando...">Enviar</SubmitButton>);
    expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled();
  });

  it('não mostra o children original enquanto carregando', () => {
    render(<SubmitButton loading>Registrar Frete</SubmitButton>);
    expect(screen.queryByText(/registrar frete/i)).not.toBeInTheDocument();
  });
});
