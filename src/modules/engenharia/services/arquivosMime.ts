/**
 * Constantes de validação de upload no módulo Engenharia.
 * Espelha os MIME types permitidos no bucket (Storage policy) e
 * adiciona uma camada de "defesa em profundidade" via file-type.
 */

/** 50 MB — alinhado com file_size_limit do bucket (D-7 2026-05-26). */
export const TAMANHO_MAX_BYTES = 52428800;

/**
 * Lista de MIME types aceitos (espelha o `allowed_mime_types` da migration).
 * Importante: o Supabase já valida MIME do header, mas a gente também valida
 * via file-type (bytes reais) para evitar bypass com header mentindo.
 */
export const MIME_PERMITIDOS: ReadonlySet<string> = new Set([
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'image/vnd.dwg',
  'application/acad',
  'application/dxf',
  'application/octet-stream',
]);

/**
 * Extensões EXPLICITAMENTE bloqueadas — mesmo que o MIME corresponda a algo
 * "ok", a extensão sozinha rejeita.
 *
 * Por quê: alguns navegadores executam arquivos baseados em extensão; assinatura
 * MIME pode ser ambígua (ex.: .scr é executável Windows mas mime pode parecer
 * inocente). Defesa em profundidade.
 */
export const EXTENSOES_BLOQUEADAS: ReadonlySet<string> = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'ps1', 'sh', 'bash',
  'dll', 'jar', 'app', 'dmg', 'pkg', 'deb', 'rpm', 'apk',
  'vbs', 'js', 'mjs', 'cjs', 'wsh', 'hta',
  'lnk',
]);

/**
 * Resultado de validação do upload. Sucesso: { ok: true }. Erro: { ok: false, motivo }.
 */
export type ResultadoValidacao =
  | { ok: true; mimeDetectado: string }
  | { ok: false; motivo: string };
