import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { TransferenciaCombustivel } from '../types';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { nome: 'Tester' } }),
}));

import { useAtualizarTransferenciaCombustivel } from './useTransferenciasCombustivel';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as Mock;

/** Monta from().update().eq().select() resolvendo em `result`. */
function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update });
  return { update, eq, select };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const transf: TransferenciaCombustivel = {
  id: 'tcf-1',
  dataHora: '2026-06-01T08:00:00',
  depositoOrigemId: 'dep-a',
  depositoDestinoId: 'dep-b',
  quantidadeLitros: 500,
  valorTotal: 3250,
  observacoes: '',
} as TransferenciaCombustivel;

beforeEach(() => vi.clearAllMocks());

describe('useAtualizarTransferenciaCombustivel', () => {
  it('atualiza e resolve quando 1 linha é alterada', async () => {
    const { update, eq } = mockUpdateChain({ data: [{ id: 'tcf-1' }], error: null });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'tcf-1');
  });

  it('rejeita quando o Supabase devolve erro', async () => {
    mockUpdateChain({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).rejects.toBeTruthy();
  });

  it('lança erro quando 0 linhas (RLS rejeitou em silêncio)', async () => {
    mockUpdateChain({ data: [], error: null });
    const { result } = renderHook(() => useAtualizarTransferenciaCombustivel(), { wrapper });
    await expect(result.current.mutateAsync(transf)).rejects.toThrow(/permiss|linha/i);
  });
});
