import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

import { useAtualizarFuncionario } from './useFuncionarios';
import { supabase } from '@/lib/supabase';
import type { Funcionario } from '../types';

const mockFrom = supabase.from as Mock;

/** Monta o encadeamento from().update().eq().select() resolvendo em `result`. */
function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ update });
  return { update, eq, select };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const funcFake = { id: 'f1', nome: 'Tiago', email: 't@e.com' } as unknown as Funcionario;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAtualizarFuncionario', () => {
  it('lança erro quando o update afeta 0 linhas (RLS rejeitou silenciosamente)', async () => {
    // Supabase: RLS bloqueia o UPDATE -> retorna sucesso com array vazio.
    mockUpdateChain({ data: [], error: null });

    const { result } = renderHook(() => useAtualizarFuncionario(), { wrapper });

    await expect(result.current.mutateAsync(funcFake)).rejects.toThrow(/permiss|linha/i);
  });

  it('resolve quando o update afeta 1 linha', async () => {
    mockUpdateChain({ data: [{ id: 'f1' }], error: null });

    const { result } = renderHook(() => useAtualizarFuncionario(), { wrapper });

    await expect(result.current.mutateAsync(funcFake)).resolves.toBeUndefined();
  });

  it('propaga erro do supabase', async () => {
    mockUpdateChain({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useAtualizarFuncionario(), { wrapper });

    await expect(result.current.mutateAsync(funcFake)).rejects.toThrow();
  });
});

// silencia warning de waitFor não usado em algum ambiente
void waitFor;
