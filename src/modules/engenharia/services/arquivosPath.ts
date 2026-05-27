/**
 * Helpers puros para construção de caminhos no bucket Storage.
 * Sem efeitos colaterais — facilmente testável e re-usável.
 */

/**
 * Converte nome em slug ASCII para uso em paths.
 * - Lowercase
 * - Remove diacríticos
 * - Substitui qualquer caractere não [a-z0-9] por '-'
 * - Comprime hífens duplicados
 * - Remove hífens das pontas
 * - Limita a 50 chars
 * - Retorna "arquivo" se resultar vazio
 */
export function slugify(input: string): string {
  const cleaned = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');

  return cleaned || 'arquivo';
}

/**
 * Extrai a última extensão de um nome de arquivo (sem o ponto).
 * - "foo.pdf" → "pdf"
 * - "backup.tar.gz" → "gz"
 * - "README" → ""
 * - ".gitignore" → ""  (hidden file sem extensão)
 */
export function extractExtension(nomeOriginal: string): string {
  const lastDot = nomeOriginal.lastIndexOf('.');
  if (lastDot <= 0) return '';
  return nomeOriginal.slice(lastDot + 1).toLowerCase();
}

/**
 * Constrói o storage_path determinístico:
 *   pastas/<pasta_id>/<arquivo_id>-<slug>[.<ext>]
 *
 * Determinístico significa: mesma combinação de inputs produz mesmo output.
 * Permite reconstruir o path em runtime sem persistir.
 */
export function buildStoragePath(params: {
  pastaId: string;
  arquivoId: string;
  nomeOriginal: string;
}): string {
  const ext = extractExtension(params.nomeOriginal);
  const baseName = ext
    ? params.nomeOriginal.slice(0, params.nomeOriginal.length - ext.length - 1)
    : params.nomeOriginal;
  const slug = slugify(baseName);
  const suffix = ext ? `.${ext}` : '';
  return `pastas/${params.pastaId}/${params.arquivoId}-${slug}${suffix}`;
}
