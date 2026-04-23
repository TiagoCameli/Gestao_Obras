import { useCallback } from "react";
import { pdfStorage } from "../utils/rodotrackerApi";

/**
 * Contrato idêntico ao antigo Dexie, mas agora falando com o bucket
 * `rodotracker-pdfs` no Supabase Storage. `getPdfs` retorna {id → signedUrl}.
 */
export function usePdfDB() {
  const savePdf = useCallback(async (id: string, data: string) => {
    await pdfStorage.upload(id, data);
  }, []);

  const getPdf = useCallback(async (id: string): Promise<string | null> => {
    const urls = await pdfStorage.getUrls([id]);
    return urls[id] ?? null;
  }, []);

  const getPdfs = useCallback(
    async (ids: string[]): Promise<Record<string, string>> => {
      return pdfStorage.getUrls(ids);
    },
    []
  );

  const deletePdf = useCallback(async (id: string) => {
    await pdfStorage.delete([id]);
  }, []);

  const deletePdfs = useCallback(async (ids: string[]) => {
    await pdfStorage.delete(ids);
  }, []);

  return { savePdf, getPdf, getPdfs, deletePdf, deletePdfs };
}
