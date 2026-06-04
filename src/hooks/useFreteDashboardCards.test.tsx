// src/hooks/useFreteDashboardCards.test.tsx
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ usuario: { funcionarioId: 'func-1' } }),
}));

import { useFreteDashboardCards, useSalvarFreteDashboardCards } from './useFreteDashboardCards';
import { supabase } from '@/lib/supabase';

const mockFrom = supabase.from as Mock;

/** Monta from().select().eq().maybeSingle() resolvendo em `result`. */
function mockSelectChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select });
  return { select, eq, maybeSingle };
}

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

beforeEach(() => vi.clearAllMocks());

describe('useFreteDashboardCards', () => {
  it('retorna o array fornecedor_ids da linha global', async () => {
    mockSelectChain({ data: { fornecedor_ids: ['a', 'b'] }, error: null });
    const { result } = renderHook(() => useFreteDashboardCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['a', 'b']);
  });

  it('retorna [] quando não há linha', async () => {
    mockSelectChain({ data: null, error: null });
    const { result } = renderHook(() => useFreteDashboardCards(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useSalvarFreteDashboardCards', () => {
  it('salva e resolve quando 1 linha é alterada', async () => {
    const { update } = mockUpdateChain({ data: [{ id: 'global' }], error: null });
    const { result } = renderHook(() => useSalvarFreteDashboardCards(), { wrapper });
    await expect(result.current.mutateAsync(['x', 'y'])).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ fornecedor_ids: ['x', 'y'], updated_por: 'func-1' }),
    );
  });

  it('lança erro quando 0 linhas (RLS rejeitou em silêncio)', async () => {
    mockUpdateChain({ data: [], error: null });
    const { result } = renderHook(() => useSalvarFreteDashboardCards(), { wrapper });
    await expect(result.current.mutateAsync(['x'])).rejects.toThrow(/permiss|linha/i);
  });
});
