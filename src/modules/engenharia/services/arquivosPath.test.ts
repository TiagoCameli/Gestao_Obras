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
    expect(extractExtension('.gitignore')).toBe('');
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
