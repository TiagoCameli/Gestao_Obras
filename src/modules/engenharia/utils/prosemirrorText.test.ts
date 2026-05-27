import { describe, it, expect } from 'vitest';
import { extrairTextoPlain } from './prosemirrorText';

describe('extrairTextoPlain', () => {
  it('extrai texto simples de um parágrafo', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'olá mundo' }] },
    ]};
    expect(extrairTextoPlain(doc)).toBe('olá mundo');
  });

  it('preserva quebra de linha via hardBreak', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [
        { type: 'text', text: 'linha 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'linha 2' },
      ]},
    ]};
    expect(extrairTextoPlain(doc)).toBe('linha 1\nlinha 2');
  });

  it('separa parágrafos com newline', () => {
    const doc = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
    ]};
    expect(extrairTextoPlain(doc)).toBe('a\nb');
  });

  it('caminha em listas aninhadas', () => {
    const doc = { type: 'doc', content: [
      { type: 'bulletList', content: [
        { type: 'listItem', content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'item 1' }] },
        ]},
        { type: 'listItem', content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'item 2' }] },
        ]},
      ]},
    ]};
    expect(extrairTextoPlain(doc)).toBe('item 1\nitem 2');
  });

  it('retorna string vazia para documento vazio', () => {
    expect(extrairTextoPlain({ type: 'doc', content: [] })).toBe('');
    expect(extrairTextoPlain(null)).toBe('');
    expect(extrairTextoPlain(undefined)).toBe('');
  });

  it('extrai texto de tabelas', () => {
    const doc = { type: 'doc', content: [
      { type: 'table', content: [
        { type: 'tableRow', content: [
          { type: 'tableCell', content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'a1' }] },
          ]},
          { type: 'tableCell', content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'b1' }] },
          ]},
        ]},
      ]},
    ]};
    expect(extrairTextoPlain(doc)).toContain('a1');
    expect(extrairTextoPlain(doc)).toContain('b1');
  });
});
