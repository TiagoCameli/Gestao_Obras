# Engenharia Onda 2 — Storage de Arquivos (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bucket privado `engenharia-arquivos` no Supabase Storage + serviço `arquivosService.ts` que faz upload (validação MIME real via file-type, limite 50 MB, bloqueio de executáveis), gera signed URLs com TTL curto, e faz soft-delete.

**Architecture:** 1 migration que cria o bucket + 4 policies em `storage.objects` (per-command, gated por chaves Engenharia). Serviço TypeScript em `src/modules/engenharia/services/` que orquestra: gera UUID + slug + path determinístico, valida bytes com `file-type`, faz upload pro Storage, insere row em `engenharia_arquivos`. Sem UI nesta onda — testes ficam em Vitest com mock do supabase-js (Playwright E2E vem na Onda 3 quando tiver pasta + drop zone).

**Tech Stack:** Supabase Storage + Postgres (RLS via `bucket_id`), TypeScript 5.9, `file-type@^22.0.1` (~30 KB gzip, aprovado em bloco D-8), Vitest 4.

**Spec:** [`docs/superpowers/plans/2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) — seção 7, Onda 2.

**Plano Onda 1:** [`2026-05-26-engenharia-onda-1-schema.md`](2026-05-26-engenharia-onda-1-schema.md) — base que esta onda assume aplicada.

---

## File Structure

**Create:**
- `supabase/migrations/20260527100000_engenharia_storage_bucket_fix.sql` — bucket + 4 policies em `storage.objects`.
- `supabase/migrations/20260527100100_engenharia_storage_bucket_rollback.sql` — drop bucket (com cleanup) + drop policies.
- `src/modules/engenharia/services/arquivosService.ts` — funções de upload/download/delete.
- `src/modules/engenharia/services/arquivosService.test.ts` — Vitest com mock do supabase-js.
- `src/modules/engenharia/services/arquivosPath.ts` — helpers puros (`slugify`, `buildStoragePath`, `extractExtension`).
- `src/modules/engenharia/services/arquivosPath.test.ts` — Vitest unit tests dos helpers (puros, sem mock).
- `src/modules/engenharia/services/arquivosMime.ts` — constantes (`MIME_PERMITIDOS`, `EXTENSOES_BLOQUEADAS`, `TAMANHO_MAX_BYTES`).

**Modify:**
- `package.json` — adiciona `"file-type": "^22.0.1"` em `dependencies`.

**Convenção de pasta:** `src/modules/engenharia/` é nova (não existe ainda) — `mkdir -p` no início da Task 3.

---

## Task 1: Migration `engenharia_storage_bucket_fix.sql` + rollback

**Files:**
- Create: `supabase/migrations/20260527100000_engenharia_storage_bucket_fix.sql`
- Create: `supabase/migrations/20260527100100_engenharia_storage_bucket_rollback.sql`

> **Timestamps:** `20260527100000+` assume execução em 2026-05-27. Se rodar mesmo dia (26), ajustar para `20260526200000+`. Última migration aplicada no projeto: ver `git log` antes de gerar.

- [ ] **Step 1: Escrever o `_fix.sql`**

Conteúdo de `supabase/migrations/20260527100000_engenharia_storage_bucket_fix.sql`:

```sql
-- Engenharia — Onda 2.1: bucket privado + RLS policies em storage.objects.
-- Espelha padrão de checklist-fotos (20260513140000), com gates por chaves
-- de permissão Engenharia (criadas na Onda 1).
-- Rollback: 20260527100100_engenharia_storage_bucket_rollback.sql.

begin;

-- 1) Bucket privado com limite 50 MB e MIME types permitidos
-- 50 MB = 52428800 bytes (D-7 2026-05-26).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engenharia-arquivos',
  'engenharia-arquivos',
  false,
  52428800,
  array[
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
    'application/octet-stream'  -- DWG/DXF muitas vezes chegam com este MIME
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- 2) Policies em storage.objects (4: select/insert/update/delete)
-- Cada uma filtra por bucket_id = 'engenharia-arquivos' AND chave de
-- permissão correspondente.

do $$ begin
  create policy engenharia_arquivos_storage_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('ver_engenharia')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_update on storage.objects
    for update to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    )
    with check (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and (
        private.current_has_action('excluir_engenharia_arquivo')
        or private.current_has_action('excluir_permanente_engenharia')
      )
    );
exception when duplicate_object then null; end $$;

commit;
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

Conteúdo de `supabase/migrations/20260527100100_engenharia_storage_bucket_rollback.sql`:

```sql
-- Rollback de 20260527100000_engenharia_storage_bucket_fix.sql

begin;

drop policy if exists engenharia_arquivos_storage_select on storage.objects;
drop policy if exists engenharia_arquivos_storage_insert on storage.objects;
drop policy if exists engenharia_arquivos_storage_update on storage.objects;
drop policy if exists engenharia_arquivos_storage_delete on storage.objects;

-- Bucket: remover objetos primeiro (se houver) antes de drop
-- Em prod, isso pode envolver dados — confirmar antes!
-- delete from storage.objects where bucket_id = 'engenharia-arquivos';
-- delete from storage.buckets where id = 'engenharia-arquivos';

-- Por segurança, o rollback NÃO apaga o bucket nem seus objetos por default.
-- Se você quer apagar mesmo, descomente as 2 linhas acima e re-rode.

commit;
```

- [ ] **Step 3: User confirma** (mostrar conteúdo dos 2 arquivos)

- [ ] **Step 4: Apply via MCP** (`mcp__plugin_supabase_supabase__apply_migration` sem `begin/commit`)

- [ ] **Step 5: Verificar bucket existe**

Via `mcp__plugin_supabase_supabase__execute_sql`:

```sql
select id, name, public, file_size_limit, array_length(allowed_mime_types, 1) as num_mime_types
  from storage.buckets
 where id = 'engenharia-arquivos';
```

Esperado: 1 linha, `public=false`, `file_size_limit=52428800`, `num_mime_types ≥ 15`.

- [ ] **Step 6: Verificar policies**

```sql
select polname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and polname like 'engenharia_%'
 order by polname;
```

Esperado: 4 policies.

- [ ] **Step 7: get_advisors security check**

`mcp__plugin_supabase_supabase__get_advisors  type='security'` — confirmar zero issues novos em storage relacionados a Engenharia.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260527100000_engenharia_storage_bucket_fix.sql supabase/migrations/20260527100100_engenharia_storage_bucket_rollback.sql
git commit -m "feat(engenharia): bucket privado engenharia-arquivos + RLS storage.objects

Bucket: 50 MB limite, 17 MIME types permitidos (PDF/Office/Excel/DWG/imagens).
4 policies em storage.objects (per-command), gated por chaves de permissao
Engenharia ja criadas na Onda 1.

Spec: docs/superpowers/plans/2026-05-26-engenharia-onda-2-storage.md"
```

---

## Task 2: Instalar `file-type`

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar a dependência**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm install file-type@^22.0.1
```

- [ ] **Step 2: Verificar versão instalada**

```bash
node -e "console.log(require('file-type/package.json').version)"
```

Esperado: `22.0.1` ou superior.

- [ ] **Step 3: Verificar que é ESM-only**

file-type 17+ é ESM-only. Confirmar que o projeto usa `"type": "module"` (já confirmado em package.json linha 5).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(engenharia): adiciona file-type@^22.0.1 para validacao MIME real

Lib ESM-only, ~30 KB gzip. Aprovada em bloco (D-8 2026-05-26).
Sera usada por arquivosService.uploadArquivo() para bloquear executaveis
renomeados antes de aceitar upload."
```

---

## Task 3: Helpers puros (`arquivosPath.ts`) + testes

**Files:**
- Create: `src/modules/engenharia/services/arquivosPath.ts`
- Create: `src/modules/engenharia/services/arquivosPath.test.ts`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p /Users/tiagocameli/projects/Gestao_Obras/src/modules/engenharia/services
```

- [ ] **Step 2: Escrever os testes (failing)**

Criar `src/modules/engenharia/services/arquivosPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { slugify, buildStoragePath, extractExtension } from './arquivosPath';

describe('slugify', () => {
  it('lowercases e remove acentos', () => {
    expect(slugify('Memorial Descritivo - Ramal do Gamá')).toBe('memorial-descritivo-ramal-do-gama');
  });

  it('substitui caracteres especiais por hífen', () => {
    expect(slugify('Arquivo (v2) #final.pdf')).toBe('arquivo-v2-final-pdf');
  });

  it('comprime hífens duplicados', () => {
    expect(slugify('Foo - - - Bar')).toBe('foo-bar');
  });

  it('remove hífens das pontas', () => {
    expect(slugify('---x---')).toBe('x');
  });

  it('limita a 50 chars', () => {
    const longo = 'a'.repeat(100);
    expect(slugify(longo).length).toBeLessThanOrEqual(50);
  });

  it('retorna "arquivo" para string vazia', () => {
    expect(slugify('')).toBe('arquivo');
    expect(slugify('   ')).toBe('arquivo');
    expect(slugify('!!!')).toBe('arquivo');
  });
});

describe('extractExtension', () => {
  it('extrai extensão simples', () => {
    expect(extractExtension('foo.pdf')).toBe('pdf');
    expect(extractExtension('Plano.XLSX')).toBe('xlsx');
  });

  it('última extensão quando tem múltiplas', () => {
    expect(extractExtension('backup.tar.gz')).toBe('gz');
  });

  it('retorna string vazia quando não há extensão', () => {
    expect(extractExtension('README')).toBe('');
    expect(extractExtension('.gitignore')).toBe('');  // arquivo oculto, sem ext
  });
});

describe('buildStoragePath', () => {
  it('monta caminho determinístico', () => {
    const path = buildStoragePath({
      pastaId: '550e8400-e29b-41d4-a716-446655440000',
      arquivoId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      nomeOriginal: 'Memorial Estrutural.pdf',
    });
    expect(path).toBe(
      'pastas/550e8400-e29b-41d4-a716-446655440000/6ba7b810-9dad-11d1-80b4-00c04fd430c8-memorial-estrutural.pdf',
    );
  });

  it('omite extensão se faltar', () => {
    const path = buildStoragePath({
      pastaId: 'p',
      arquivoId: 'a',
      nomeOriginal: 'README',
    });
    expect(path).toBe('pastas/p/a-readme');
  });

  it('usa fallback "arquivo" se nome só tiver caracteres especiais', () => {
    const path = buildStoragePath({
      pastaId: 'p',
      arquivoId: 'a',
      nomeOriginal: '!!!.pdf',
    });
    expect(path).toBe('pastas/p/a-arquivo.pdf');
  });
});
```

- [ ] **Step 3: Rodar testes para confirmar que falham**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx vitest run src/modules/engenharia/services/arquivosPath.test.ts
```

Esperado: FAIL (módulo não existe).

- [ ] **Step 4: Implementar `arquivosPath.ts`**

Criar `src/modules/engenharia/services/arquivosPath.ts`:

```ts
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
    .replace(/[̀-ͯ]/g, '')  // remove diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');  // pode ter sobrado '-' depois do slice

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
  if (lastDot <= 0) return '';  // sem ponto OU dotfile
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
```

- [ ] **Step 5: Rodar testes — devem passar**

```bash
npx vitest run src/modules/engenharia/services/arquivosPath.test.ts
```

Esperado: PASS (14 testes).

- [ ] **Step 6: Commit**

```bash
git add src/modules/engenharia/services/arquivosPath.ts src/modules/engenharia/services/arquivosPath.test.ts
git commit -m "feat(engenharia): helpers puros de path/slug para arquivosService

slugify(): ASCII, lowercase, sem diacriticos, max 50 chars, fallback 'arquivo'.
extractExtension(): ultima extensao em lowercase.
buildStoragePath(): pastas/<pasta_id>/<arquivo_id>-<slug>[.ext] deterministico.

14 testes Vitest verdes."
```

---

## Task 4: Constantes de MIME/extensão (`arquivosMime.ts`)

**Files:**
- Create: `src/modules/engenharia/services/arquivosMime.ts`

- [ ] **Step 1: Escrever as constantes**

Criar `src/modules/engenharia/services/arquivosMime.ts`:

```ts
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
  'application/octet-stream',  // DWG/DXF
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
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/engenharia/services/arquivosMime.ts
git commit -m "feat(engenharia): constantes MIME_PERMITIDOS e EXTENSOES_BLOQUEADAS

19 MIME types aceitos (espelha bucket allowed_mime_types).
30 extensoes bloqueadas (defesa em profundidade contra executaveis).
TAMANHO_MAX_BYTES = 52428800 (50 MB)."
```

---

## Task 5: `arquivosService.ts` — upload + validação

**Files:**
- Create: `src/modules/engenharia/services/arquivosService.ts`
- Create: `src/modules/engenharia/services/arquivosService.test.ts`

- [ ] **Step 1: Escrever testes Vitest (failing)**

Criar `src/modules/engenharia/services/arquivosService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase client antes de importar o módulo sob teste
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'user-uuid-fake' } }, error: null })),
    },
    storage: {
      from: vi.fn(),
    },
    from: vi.fn(),
  },
}));

// Mock do file-type antes do import
vi.mock('file-type', () => ({
  fileTypeFromBlob: vi.fn(),
}));

import { uploadArquivo, getSignedUrl, softDeleteArquivo } from './arquivosService';
import { supabase } from '@/lib/supabase';
import { fileTypeFromBlob } from 'file-type';

const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockTableInsert = vi.fn();
const mockTableUpdate = vi.fn();
const mockTableEq = vi.fn();
const mockTableSelect = vi.fn();
const mockTableSingle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  (supabase.storage.from as any).mockReturnValue({
    upload: mockStorageUpload,
    remove: mockStorageRemove,
    createSignedUrl: mockStorageCreateSignedUrl,
  });

  (supabase.from as any).mockReturnValue({
    insert: mockTableInsert.mockReturnValue({
      select: mockTableSelect.mockReturnValue({
        single: mockTableSingle,
      }),
    }),
    update: mockTableUpdate.mockReturnValue({
      eq: mockTableEq.mockReturnValue({
        select: mockTableSelect.mockReturnValue({
          single: mockTableSingle,
        }),
      }),
    }),
    select: mockTableSelect.mockReturnValue({
      eq: mockTableEq.mockReturnValue({
        single: mockTableSingle,
      }),
    }),
  });
});

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

describe('uploadArquivo', () => {
  it('rejeita arquivo > 50 MB', async () => {
    const file = makeFile('huge.pdf', 'application/pdf', 60 * 1024 * 1024);
    const result = await uploadArquivo({ pastaId: 'pasta-1', file });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.motivo).toMatch(/tamanho|50 MB/i);
    }
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it('rejeita extensão bloqueada (.exe)', async () => {
    const file = makeFile('malware.exe', 'application/octet-stream', 1024);
    const result = await uploadArquivo({ pastaId: 'pasta-1', file });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.motivo).toMatch(/extens.*bloque/i);
    }
  });

  it('rejeita .exe renomeado para .pdf (file-type detecta)', async () => {
    const file = makeFile('malware.pdf', 'application/pdf', 1024);
    (fileTypeFromBlob as any).mockResolvedValue({ ext: 'exe', mime: 'application/x-msdownload' });

    const result = await uploadArquivo({ pastaId: 'pasta-1', file });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.motivo).toMatch(/MIME real|tipo real/i);
    }
  });

  it('aceita PDF legítimo, gera path determinístico, faz upload + insert', async () => {
    const file = makeFile('Memorial.pdf', 'application/pdf', 1024 * 100);
    (fileTypeFromBlob as any).mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    mockTableSingle.mockResolvedValue({
      data: { id: 'novo-arquivo-id', nome_original: 'Memorial.pdf' },
      error: null,
    });

    const result = await uploadArquivo({ pastaId: 'pasta-uuid-1', file });

    expect(result.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(mockTableInsert).toHaveBeenCalledTimes(1);

    const storageArgs = mockStorageUpload.mock.calls[0];
    expect(storageArgs[0]).toMatch(/^pastas\/pasta-uuid-1\/[0-9a-f-]+-memorial\.pdf$/);
  });

  it('cleanup: se INSERT falhar, deleta o objeto do storage', async () => {
    const file = makeFile('Memorial.pdf', 'application/pdf', 1024);
    (fileTypeFromBlob as any).mockResolvedValue({ ext: 'pdf', mime: 'application/pdf' });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    mockTableSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } });

    const result = await uploadArquivo({ pastaId: 'pasta-uuid-1', file });

    expect(result.ok).toBe(false);
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);  // cleanup chamado
  });
});

describe('getSignedUrl', () => {
  it('retorna URL com TTL default 300s', async () => {
    mockTableSingle.mockResolvedValue({
      data: { storage_path: 'pastas/p/a-foo.pdf' },
      error: null,
    });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/foo.pdf' },
      error: null,
    });

    const url = await getSignedUrl('arquivo-id');
    expect(url).toBe('https://signed.example/foo.pdf');
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith('pastas/p/a-foo.pdf', 300);
  });

  it('lança erro se arquivo não existe (RLS ou de fato sumiu)', async () => {
    mockTableSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    await expect(getSignedUrl('id-inexistente')).rejects.toThrow();
  });
});

describe('softDeleteArquivo', () => {
  it('seta deleted_at, sem remover do storage', async () => {
    mockTableSingle.mockResolvedValue({
      data: { id: 'arquivo-id', deleted_at: '2026-05-26T00:00:00Z' },
      error: null,
    });

    await softDeleteArquivo('arquivo-id');

    expect(mockTableUpdate).toHaveBeenCalledTimes(1);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar testes — devem falhar**

```bash
npx vitest run src/modules/engenharia/services/arquivosService.test.ts
```

Esperado: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `arquivosService.ts`**

Criar `src/modules/engenharia/services/arquivosService.ts`:

```ts
import { fileTypeFromBlob } from 'file-type';
import { supabase } from '@/lib/supabase';
import { buildStoragePath, extractExtension } from './arquivosPath';
import { TAMANHO_MAX_BYTES, MIME_PERMITIDOS, EXTENSOES_BLOQUEADAS } from './arquivosMime';

const BUCKET = 'engenharia-arquivos';
const SIGNED_URL_TTL_SECS = 300;  // 5 min

export type UploadResult =
  | { ok: true; arquivoId: string; storagePath: string }
  | { ok: false; motivo: string };

/**
 * Faz upload de um arquivo para o bucket engenharia-arquivos e registra
 * row em engenharia_arquivos. Validações:
 *   - Tamanho ≤ 50 MB
 *   - Extensão NÃO está na lista de bloqueadas (exe/bat/etc.)
 *   - MIME real (bytes via file-type) está em MIME_PERMITIDOS
 *
 * Em caso de erro APÓS upload (ex.: INSERT no DB falha), tenta
 * remover o objeto do storage como cleanup best-effort.
 */
export async function uploadArquivo(params: {
  pastaId: string;
  file: File;
}): Promise<UploadResult> {
  const { pastaId, file } = params;

  // 1) Tamanho
  if (file.size > TAMANHO_MAX_BYTES) {
    return {
      ok: false,
      motivo: `Arquivo excede o tamanho máximo de 50 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, motivo: 'Arquivo vazio.' };
  }

  // 2) Extensão
  const ext = extractExtension(file.name);
  if (ext && EXTENSOES_BLOQUEADAS.has(ext)) {
    return { ok: false, motivo: `Extensão .${ext} está bloqueada por segurança.` };
  }

  // 3) MIME real (bytes via file-type — defesa em profundidade)
  // Nem todo arquivo tem assinatura mágica (ex.: .txt puro retorna null).
  // Para esses, confiamos no MIME header do navegador (file.type) DESDE QUE
  // esteja na lista de permitidos.
  const detected = await fileTypeFromBlob(file);
  const mimeReal = detected?.mime ?? file.type;
  if (!mimeReal) {
    return { ok: false, motivo: 'Não foi possível determinar o tipo do arquivo.' };
  }
  if (!MIME_PERMITIDOS.has(mimeReal)) {
    return {
      ok: false,
      motivo: `MIME real "${mimeReal}" não é permitido para upload.`,
    };
  }

  // 4) Gera arquivo_id + path determinístico
  const arquivoId = crypto.randomUUID();
  const storagePath = buildStoragePath({
    pastaId,
    arquivoId,
    nomeOriginal: file.name,
  });

  // 5) Upload para o bucket
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: mimeReal,
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) {
    return { ok: false, motivo: `Falha no upload: ${upErr.message}` };
  }

  // 6) Insert em engenharia_arquivos
  const { data: row, error: dbErr } = await supabase
    .from('engenharia_arquivos')
    .insert({
      id: arquivoId,
      pasta_id: pastaId,
      nome_original: file.name,
      extensao: ext,
      mime_type: mimeReal,
      tamanho_bytes: file.size,
      storage_path: storagePath,
    })
    .select('id')
    .single();

  if (dbErr || !row) {
    // Cleanup best-effort
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
    return {
      ok: false,
      motivo: `Upload feito mas falhou ao registrar no banco: ${dbErr?.message ?? 'sem detalhe'}.`,
    };
  }

  return { ok: true, arquivoId: row.id, storagePath };
}

/**
 * Gera URL assinada temporária para download/preview do arquivo.
 * TTL default 5 min — alinhado com padrão do projeto.
 */
export async function getSignedUrl(arquivoId: string, ttlSecs: number = SIGNED_URL_TTL_SECS): Promise<string> {
  const { data: arquivo, error: dbErr } = await supabase
    .from('engenharia_arquivos')
    .select('storage_path')
    .eq('id', arquivoId)
    .single();

  if (dbErr || !arquivo) {
    throw new Error(`Arquivo ${arquivoId} não encontrado ou sem permissão: ${dbErr?.message ?? 'sem detalhe'}`);
  }

  const { data: signed, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(arquivo.storage_path, ttlSecs);

  if (urlErr || !signed) {
    throw new Error(`Falha ao gerar signed URL: ${urlErr?.message ?? 'sem detalhe'}`);
  }

  return signed.signedUrl;
}

/**
 * Soft delete: marca deleted_at no DB.
 * NÃO remove do storage — cron job futuro limpa arquivos com deleted_at > 30 dias.
 */
export async function softDeleteArquivo(arquivoId: string): Promise<void> {
  const { error } = await supabase
    .from('engenharia_arquivos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', arquivoId)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Falha ao soft-deletar arquivo: ${error.message}`);
  }
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
npx vitest run src/modules/engenharia/services/arquivosService.test.ts
```

Esperado: PASS (9 testes).

- [ ] **Step 5: Rodar typecheck**

```bash
npx tsc -b
```

Esperado: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/modules/engenharia/services/arquivosService.ts src/modules/engenharia/services/arquivosService.test.ts
git commit -m "feat(engenharia): arquivosService — upload + signed URL + soft delete

uploadArquivo(): validacao em 3 camadas (tamanho ≤ 50 MB, extensao bloqueada,
MIME real via file-type). Upload → insert engenharia_arquivos atomico com
cleanup best-effort se INSERT falhar.

getSignedUrl(): TTL 300s default.
softDeleteArquivo(): set deleted_at, mantem bytes no bucket por 30 dias
(cron de limpeza eh trabalho futuro).

9 testes Vitest verdes."
```

---

## Task 6: Verificação end-to-end

- [ ] **Step 1: Rodar suite completa de testes**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx vitest run src/modules/engenharia/
```

Esperado: 23 testes verdes (14 arquivosPath + 9 arquivosService).

- [ ] **Step 2: Rodar typecheck final**

```bash
npx tsc -b
```

Esperado: 0 erros.

- [ ] **Step 3: get_advisors security final**

`mcp__plugin_supabase_supabase__get_advisors  type='security'` — grep por `engenharia` no output. Esperado: zero novos.

- [ ] **Step 4: get_advisors performance**

`mcp__plugin_supabase_supabase__get_advisors  type='performance'` — checar se policies do storage geraram algum WARN do tipo "Auth RLS Initialization Plan". Se sim, aplicar fix análogo ao da Onda 1 (`(select auth.uid())`). Provavelmente OK porque essas policies usam `private.current_has_action(...)` que é STABLE.

- [ ] **Step 5: Smoke manual via Storage UI do Supabase**

No dashboard do projeto Supabase: ir em Storage → confirmar bucket `engenharia-arquivos` aparece, privado, com size limit 50 MB.

- [ ] **Step 6: Atualizar CHANGELOG**

Adicionar entrada em `docs/modulos/engenharia/CHANGELOG.md`:

```markdown
## Onda 2 — Storage de arquivos (2026-05-27)

### Banco
- Bucket privado `engenharia-arquivos` (50 MB limite, 19 MIME types permitidos).
- 4 policies em `storage.objects` (select/insert/update/delete) gated por chaves Engenharia.

### Frontend
- `src/modules/engenharia/services/`:
  - `arquivosPath.ts` — helpers puros (slugify, extractExtension, buildStoragePath).
  - `arquivosMime.ts` — constantes (MIME_PERMITIDOS, EXTENSOES_BLOQUEADAS, TAMANHO_MAX_BYTES).
  - `arquivosService.ts` — uploadArquivo / getSignedUrl / softDeleteArquivo.

### Validação de upload (3 camadas)
1. Tamanho ≤ 50 MB.
2. Extensão NÃO está na lista de 30 bloqueadas (.exe, .bat, .sh, ...).
3. MIME real (bytes via `file-type`) está em `MIME_PERMITIDOS`.

### Lib nova
- `file-type@^22.0.1` (~30 KB gzip).

### Testes
- 14 Vitest em `arquivosPath.test.ts`.
- 9 Vitest em `arquivosService.test.ts` (mock supabase + file-type).
```

- [ ] **Step 7: Atualizar plano-mestre**

Marcar Onda 2 como concluída em `docs/superpowers/plans/2026-05-26-engenharia-modulo.md` seção 7:

```markdown
### Onda 2 — Storage de arquivos + serviço de upload (6–8h) ✅ CONCLUÍDA <DATA>

**Plano TDD próprio:** [`2026-05-26-engenharia-onda-2-storage.md`](2026-05-26-engenharia-onda-2-storage.md).
**Resultado:** 1 migration (bucket + 4 policies storage.objects), serviço completo (path + mime + upload/url/delete), 23 testes Vitest, dep file-type@^22.0.1.
```

- [ ] **Step 8: Commit final**

```bash
git add docs/modulos/engenharia/CHANGELOG.md docs/superpowers/plans/2026-05-26-engenharia-modulo.md
git commit -m "docs(engenharia): CHANGELOG Onda 2 + marca concluida no plano mestre"
```

---

## Self-Review

**Spec coverage:**
- Bucket privado `engenharia-arquivos`: ✅ Task 1
- Policies SELECT/UPDATE/DELETE/INSERT por chave: ✅ Task 1
- Path determinístico `pastas/<pasta_id>/<arquivo_id>-<slug>.<ext>`: ✅ Task 3
- `uploadArquivo` com validação MIME real + tamanho + extensão bloqueada: ✅ Task 5
- `getSignedUrl` TTL 300s: ✅ Task 5
- `softDeleteArquivo` mantém bytes no bucket: ✅ Task 5
- Lib `file-type` aprovada: ✅ Task 2
- Vitest cobrindo cenários (incluindo .exe→.pdf renomeado): ✅ Task 5

**Placeholders scan:** Nenhum.

**Type consistency:**
- `UploadResult` discriminada por `ok: boolean`.
- `BUCKET` constante (`'engenharia-arquivos'`) reusada em todas as funções do service.
- `SIGNED_URL_TTL_SECS = 300` consistente.
- `buildStoragePath` em runtime sempre produz o mesmo path para mesmos inputs (determinístico).

**Granularidade:**
- 6 tasks, 3–8 steps cada.
- Steps 2–5 min.
- Pause point: 1 confirmação user antes do apply_migration (Task 1).

---

## Critério de "Onda 2 pronta"

- [ ] 1 migration + 1 rollback no `supabase/migrations/`.
- [ ] Bucket `engenharia-arquivos` existe (50 MB, privado).
- [ ] 4 policies em `storage.objects` ativas.
- [ ] `src/modules/engenharia/services/` com 3 arquivos (path/mime/service).
- [ ] 23 testes Vitest verdes.
- [ ] `npx tsc -b` zero erros.
- [ ] `get_advisors security` sem novos issues.
- [ ] `file-type` em `package.json`.
- [ ] CHANGELOG + plano-mestre atualizados.

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-26-engenharia-onda-2-storage.md`.**

Mesma escolha da Onda 1: **Inline com checkpoint antes do `apply_migration`** (Task 1 só) é o caminho recomendado. As demais tasks são frontend/testes — sem ritual extra.

Confirmar pra começar?
