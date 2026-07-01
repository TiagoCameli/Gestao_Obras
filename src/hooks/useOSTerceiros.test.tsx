import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { nome: 'Tester' } }),
}));

import { useAdicionarTerceiroOS } from './useOSTerceiros';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as Mock;

/** Monta from().insert().select() resolvendo em `result`. */
function mockInsertChain(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const insert = vi.fn(() => ({ select }));
  mockFrom.mockReturnValue({ insert });
  return { insert, select };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const terceiroInput = {
  osId: 'os-123',
  prestador: 'Oficina Silva',
  descricao: 'Troca de correia dentada',
  valor: 850,
  notaFiscal: 'NF-001',
  createdBy: 'tester',
};

beforeEach(() => vi.clearAllMocks());

describe('useAdicionarTerceiroOS', () => {
  it('chama supabase insert().select() e resolve com os dados inseridos', async () => {
    const row = { id: 'id-1', os_id: 'os-123', prestador: 'Oficina Silva', descricao: 'Troca de correia dentada', valor: 850, nota_fiscal: 'NF-001', created_at: '2026-06-30', created_by: 'tester' };
    const { insert } = mockInsertChain({ data: [row], error: null });
    const { result } = renderHook(() => useAdicionarTerceiroOS(), { wrapper });
    const ret = await result.current.mutateAsync(terceiroInput);
    expect(insert).toHaveBeenCalled();
    expect(ret).toMatchObject({ osId: 'os-123', prestador: 'Oficina Silva', valor: 850 });
  });

  it('lança erro quando select retorna array vazio (RLS negou silenciosamente)', async () => {
    mockInsertChain({ data: [], error: null });
    const { result } = renderHook(() => useAdicionarTerceiroOS(), { wrapper });
    await expect(result.current.mutateAsync(terceiroInput)).rejects.toThrow(/permiss|linha/i);
  });

  it('lança erro quando Supabase retorna error', async () => {
    mockInsertChain({ data: null, error: { message: 'db error' } });
    const { result } = renderHook(() => useAdicionarTerceiroOS(), { wrapper });
    await expect(result.current.mutateAsync(terceiroInput)).rejects.toThrow();
  });
});
