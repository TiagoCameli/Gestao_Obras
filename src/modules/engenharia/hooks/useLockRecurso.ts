import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TTL_SEGUNDOS = 300;         // 5 min — alinhado com função SQL
const HEARTBEAT_MS = 60_000;      // renova a cada 1 min
const POLL_QUANDO_BLOQUEADO_MS = 15_000;  // tenta readquirir a cada 15s

export type EstadoLock =
  | { status: 'carregando' }
  | { status: 'meu'; expiraEm: string }
  | { status: 'outro'; donoUsuarioId: string; expiraEm: string }
  | { status: 'erro'; motivo: string };

/**
 * Adquire ou renova lock pessimista em uma nota/cálculo.
 * - Faz acquire ao montar.
 * - Heartbeat a cada 60s enquanto for dono (renova TTL pra 5 min).
 * - Polling 15s quando NÃO é dono (tenta readquirir).
 * - Release ao desmontar (best-effort).
 */
export function useLockRecurso(
  recursoTipo: 'nota' | 'calculo',
  recursoId: string | null,
): EstadoLock {
  const [estado, setEstado] = useState<EstadoLock>({ status: 'carregando' });
  const heartbeatRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recursoId) return;
    let cancelado = false;

    async function acquire() {
      const { data, error } = await supabase.rpc('engenharia_acquire_lock', {
        p_recurso_tipo: recursoTipo,
        p_recurso_id: recursoId,
        p_ttl_segundos: TTL_SEGUNDOS,
      });
      if (cancelado) return;
      if (error) {
        setEstado({ status: 'erro', motivo: error.message });
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setEstado({ status: 'erro', motivo: 'sem retorno do acquire_lock' });
        return;
      }

      if (row.adquirido) {
        setEstado({ status: 'meu', expiraEm: row.expira_em });
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = window.setInterval(() => { void acquire(); }, HEARTBEAT_MS);
      } else {
        setEstado({
          status: 'outro',
          donoUsuarioId: row.dono_usuario_id,
          expiraEm: row.expira_em,
        });
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (!pollRef.current) {
          pollRef.current = window.setInterval(() => { void acquire(); }, POLL_QUANDO_BLOQUEADO_MS);
        }
      }
    }

    void acquire();

    return () => {
      cancelado = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      void supabase.rpc('engenharia_release_lock', {
        p_recurso_tipo: recursoTipo,
        p_recurso_id: recursoId,
      });
    };
  }, [recursoTipo, recursoId]);

  return estado;
}
