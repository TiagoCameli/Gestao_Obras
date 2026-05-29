import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Funcionario } from '../../types';

// Form depende de useFuncionarios (lista p/ checar email duplicado) e useAuth.
vi.mock('../../hooks/useFuncionarios', () => ({
  useFuncionarios: () => ({ data: [] }),
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { funcionarioId: 'admin-1', cargo: 'Administrador' } }),
}));

import FuncionarioForm from './FuncionarioForm';

const alvo: Funcionario = {
  id: 'f-2',
  nome: 'Fulano de Tal',
  email: 'fulano@e.com',
  cpf: '',
  telefone: '',
  dataNascimento: '',
  endereco: { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
  senha: '',
  status: 'ativo',
  cargo: 'Operador',
  dataAdmissao: '',
  observacoes: '',
  dataCriacao: '2026-01-01T00:00:00.000Z',
  dataAtualizacao: '2026-01-01T00:00:00.000Z',
  acoesPermitidas: ['ver_dashboard'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FuncionarioForm — feedback de erro ao salvar', () => {
  it('mostra mensagem de erro quando onSubmit rejeita (salvar falhou)', async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new Error('Não foi possível salvar: você não tem permissão para editar este usuário (nenhuma linha foi alterada).')
    );

    render(<FuncionarioForm initial={alvo} onSubmit={onSubmit} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /salvar altera/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await screen.findByText(/não foi possível salvar/i);
  });
});
