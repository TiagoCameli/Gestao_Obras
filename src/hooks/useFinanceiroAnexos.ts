import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const BUCKET = 'financeiro-anexos';
const SIGNED_URL_TTL_SECS = 60 * 60;

export async function obterUrlAnexoFinanceiro(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    // backwards-compat: linha antiga que ainda traz a URL pública inteira
    return path;
  }
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECS);
  if (error) {
    console.warn('[financeiro_anexos] signed url:', error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export function useAnexosFinanceiroUrls(paths: string[] | undefined | null) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const list = paths ?? [];
    if (list.length === 0) {
      setUrls({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        list.map(async (p) => [p, await obterUrlAnexoFinanceiro(p)] as const),
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [p, u] of entries) if (u) next[p] = u;
      setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [paths?.join('|')]);

  return urls;
}
