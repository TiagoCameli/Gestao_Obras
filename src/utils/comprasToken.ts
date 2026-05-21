/**
 * Geração de tokens únicos para o portal público do fornecedor.
 *
 * Token: 32 caracteres alfanuméricos (case-sensitive). Entropia ~190 bits,
 * suficiente para ser ininferível e único na prática.
 */

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function gerarTokenCotacao(tamanho: number = 32): string {
  const bytes = new Uint8Array(tamanho);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < tamanho; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < tamanho; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

/**
 * Monta a URL pública do portal de resposta para um token.
 *
 * SEMPRE usa o domínio público fixo emtconstrutora.com — o link é enviado
 * pro fornecedor por WhatsApp/email e fica em mensagens permanentes; não
 * pode codificar localhost (dev) nem URL de preview Vercel.
 * Override possível via VITE_PORTAL_URL pra staging/ambientes alternativos.
 */
export function urlPortalCotacao(token: string): string {
  const envBase = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PORTAL_URL;
  const base = (envBase || 'https://emtconstrutora.com').replace(/\/$/, '');
  return `${base}/cotacao/r/${token}`;
}
