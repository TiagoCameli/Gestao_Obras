import { useCallback } from "react";
import { photoStorage } from "../utils/rodotrackerApi";

/**
 * Hook que mantém a mesma forma da API antiga (base em IndexedDB) mas agora
 * fala com o bucket `rodotracker-photos` no Supabase Storage.
 *
 * Nota importante: `savePhoto` recebe o `dataUrl` base64 (como antes) e faz
 * upload. `getPhotos` devolve {id → signedUrl} — os componentes já usam esse
 * valor como `<img src>`, então o contrato visual é preservado.
 */
export function usePhotoDB() {
  const savePhoto = useCallback(async (id: string, data: string) => {
    await photoStorage.upload(id, data);
  }, []);

  const getPhoto = useCallback(async (id: string): Promise<string | null> => {
    const urls = await photoStorage.getUrls([id]);
    return urls[id] ?? null;
  }, []);

  const getPhotos = useCallback(async (ids: string[]): Promise<Record<string, string>> => {
    return photoStorage.getUrls(ids);
  }, []);

  const deletePhoto = useCallback(async (id: string) => {
    await photoStorage.delete([id]);
  }, []);

  const deletePhotos = useCallback(async (ids: string[]) => {
    await photoStorage.delete(ids);
  }, []);

  return { savePhoto, getPhoto, getPhotos, deletePhoto, deletePhotos };
}
