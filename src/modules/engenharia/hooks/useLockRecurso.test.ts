import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { useLockRecurso } from './useLockRecurso';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLockRecurso', () => {
  it('status=carregando antes da resposta', () => {
    mockRpc.mockReturnValue(new Promise(() => {}));  // never resolves
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    expect(result.current.status).toBe('carregando');
  });

  it('status=meu quando acquire retorna adquirido=true', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: true, dono_usuario_id: 'user-x', expira_em: '2026-05-27T12:00:00Z' }],
      error: null,
    });
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await vi.waitFor(() => expect(result.current.status).toBe('meu'));
    if (result.current.status === 'meu') {
      expect(result.current.expiraEm).toBe('2026-05-27T12:00:00Z');
    }
  });

  it('status=outro quando outro dono', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: false, dono_usuario_id: 'outro-user', expira_em: '2026-05-27T12:05:00Z' }],
      error: null,
    });
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await vi.waitFor(() => expect(result.current.status).toBe('outro'));
    if (result.current.status === 'outro') {
      expect(result.current.donoUsuarioId).toBe('outro-user');
    }
  });

  it('chama release_lock no unmount', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: true, dono_usuario_id: 'me', expira_em: '2026-05-27T12:00:00Z' }],
      error: null,
    });
    const { unmount } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await vi.waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('engenharia_acquire_lock', expect.any(Object)),
    );
    unmount();
    expect(mockRpc).toHaveBeenCalledWith('engenharia_release_lock', {
      p_recurso_tipo: 'nota',
      p_recurso_id: 'nota-1',
    });
  });

  it('null recursoId → no-op (não chama RPC)', () => {
    renderHook(() => useLockRecurso('nota', null));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
