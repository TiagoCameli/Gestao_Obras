import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do supabase client antes do import
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

vi.mock('file-type', () => ({
  fileTypeFromBlob: vi.fn(),
}));

import { uploadArquivo, getSignedUrl, softDeleteArquivo } from './arquivosService';
import { supabase } from '@/lib/supabase';
import { fileTypeFromBlob } from 'file-type';

// Storage chain mocks (planos — supabase.storage.from(B).upload/remove/createSignedUrl)
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();

// Terminal: `.single()` retorna o resultado. Reconfigurado por teste.
const mockTableSingle = vi.fn();

// Spies pros métodos do builder (pra `toHaveBeenCalledTimes`)
let spyInsert: ReturnType<typeof vi.fn>;
let spyUpdate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  // Builder fluente: insert/update/select/eq retornam o próprio builder.
  // `.single()` é o terminal. Cobre as 3 chains do service:
  //   - insert(x).select('col').single()
  //   - update(x).eq('id', y).select('col').single()
  //   - select('col').eq('id', y).single()
  const builder: Record<string, ReturnType<typeof vi.fn>> = {} as never;
  spyInsert = vi.fn(() => builder);
  spyUpdate = vi.fn(() => builder);
  builder.insert = spyInsert;
  builder.update = spyUpdate;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = mockTableSingle;

  (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(builder);

  // Storage chain
  (supabase.storage.from as ReturnType<typeof vi.fn>).mockReturnValue({
    upload: mockStorageUpload,
    remove: mockStorageRemove.mockResolvedValue({ data: null, error: null }),
    createSignedUrl: mockStorageCreateSignedUrl,
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
    (fileTypeFromBlob as ReturnType<typeof vi.fn>).mockResolvedValue({
      ext: 'exe',
      mime: 'application/x-msdownload',
    });

    const result = await uploadArquivo({ pastaId: 'pasta-1', file });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.motivo).toMatch(/MIME real|tipo real|application\/x-msdownload/i);
    }
  });

  it('aceita PDF legítimo, gera path determinístico, faz upload + insert', async () => {
    const file = makeFile('Memorial.pdf', 'application/pdf', 1024 * 100);
    (fileTypeFromBlob as ReturnType<typeof vi.fn>).mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    mockTableSingle.mockResolvedValue({
      data: { id: 'novo-arquivo-id', nome_original: 'Memorial.pdf' },
      error: null,
    });

    const result = await uploadArquivo({ pastaId: 'pasta-uuid-1', file });

    expect(result.ok).toBe(true);
    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(spyInsert).toHaveBeenCalledTimes(1);

    const storageArgs = mockStorageUpload.mock.calls[0];
    expect(storageArgs[0]).toMatch(/^pastas\/pasta-uuid-1\/[0-9a-f-]+-memorial\.pdf$/);
  });

  it('cleanup: se INSERT falhar, deleta o objeto do storage', async () => {
    const file = makeFile('Memorial.pdf', 'application/pdf', 1024);
    (fileTypeFromBlob as ReturnType<typeof vi.fn>).mockResolvedValue({
      ext: 'pdf',
      mime: 'application/pdf',
    });
    mockStorageUpload.mockResolvedValue({ data: { path: 'ok' }, error: null });
    mockTableSingle.mockResolvedValue({ data: null, error: { message: 'RLS denied' } });

    const result = await uploadArquivo({ pastaId: 'pasta-uuid-1', file });

    expect(result.ok).toBe(false);
    expect(mockStorageRemove).toHaveBeenCalledTimes(1);
  });

  it('rejeita arquivo vazio (0 bytes)', async () => {
    const file = makeFile('empty.pdf', 'application/pdf', 0);
    const result = await uploadArquivo({ pastaId: 'pasta-1', file });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.motivo).toMatch(/vazio/i);
    }
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

  it('aceita TTL customizado', async () => {
    mockTableSingle.mockResolvedValue({
      data: { storage_path: 'p/x.pdf' },
      error: null,
    });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://x' },
      error: null,
    });
    await getSignedUrl('id', 60);
    expect(mockStorageCreateSignedUrl).toHaveBeenCalledWith('p/x.pdf', 60);
  });
});

describe('softDeleteArquivo', () => {
  it('seta deleted_at, sem remover do storage', async () => {
    mockTableSingle.mockResolvedValue({
      data: { id: 'arquivo-id' },
      error: null,
    });

    await softDeleteArquivo('arquivo-id');

    expect(spyUpdate).toHaveBeenCalledTimes(1);
    expect(mockStorageRemove).not.toHaveBeenCalled();
  });

  it('lança erro se update falhar', async () => {
    mockTableSingle.mockResolvedValue({
      data: null,
      error: { message: 'RLS' },
    });
    await expect(softDeleteArquivo('arquivo-id')).rejects.toThrow(/RLS/);
  });
});
