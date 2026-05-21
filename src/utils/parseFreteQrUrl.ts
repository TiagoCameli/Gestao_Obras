/**
 * Extrai o ID do equipamento de uma string lida de QR code.
 *
 * Aceita 5 formatos comuns (URL completa com qualquer host, path relativo,
 * ID puro). Rejeita lixo (vCard, URL aleatória, string vazia, ID < 4 chars,
 * input > 500 chars).
 *
 * Spec: docs/superpowers/specs/2026-05-21-qr-scanner-mobile-design.md
 */

const PATH_REGEX = /\/m\/eq\/([a-z0-9-]{4,32})(?:[/?#]|$)/i
const ID_ONLY_REGEX = /^[a-z0-9-]{4,32}$/i

export function extractEquipamentoId(text: string): string | null {
  if (!text || text.length > 500) return null
  const trimmed = text.trim()
  const match = trimmed.match(PATH_REGEX)
  if (match) return match[1]
  if (ID_ONLY_REGEX.test(trimmed)) return trimmed
  return null
}
