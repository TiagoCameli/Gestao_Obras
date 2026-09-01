// Regressão: "clico em Cadastrar e nada acontece" na tela Etapas de obra.
//
// `rodotracker_contract_items.obra_id` tem FK para `rodotracker_obras(id)` —
// a extensão geo, que é OPCIONAL. Obra criada no Cadastros existe só em
// `obras`, então o insert morria com 23503 (foreign key violation) e a tela
// engolia o erro. Provado no banco em 01/09/2026: obra `mthsfsk7aaqux`
// ("007 - AC - 405 Lote 2") recusava o insert; obra com extensão aceitava.
//
// O contrato agora é: quem grava item de contrato garante a extensão antes.

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { insertContractItem, replaceContractItems } from './rodotrackerApi';
import { supabase } from '@/lib/supabase';
import type { ContractItem } from '../types/activity';

const mockFrom = supabase.from as unknown as Mock;
const mockGetUser = supabase.auth.getUser as unknown as Mock;

type Chamada = { tabela: string; op: string; payload: unknown };

/**
 * Fake do client. `extensaoExiste` decide se `rodotracker_obras` já tem a
 * linha da obra — é o único eixo que separa os dois cenários do teste.
 */
function montarSupabase(extensaoExiste: boolean) {
  const chamadas: Chamada[] = [];

  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

  mockFrom.mockImplementation((tabela: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          chamadas.push({ tabela, op: 'select', payload: null });
          if (tabela === 'rodotracker_obras') {
            return { data: extensaoExiste ? { id: 'obra-1' } : null, error: null };
          }
          if (tabela === 'obras') {
            return { data: { id: 'obra-1', nome: '007 - AC - 405 Lote 2' }, error: null };
          }
          return { data: null, error: null };
        },
      }),
    }),
    upsert: async (payload: unknown) => {
      chamadas.push({ tabela, op: 'upsert', payload });
      return { error: null };
    },
    insert: async (payload: unknown) => {
      chamadas.push({ tabela, op: 'insert', payload });
      return { error: null };
    },
    delete: () => ({
      eq: async () => {
        chamadas.push({ tabela, op: 'delete', payload: null });
        return { error: null };
      },
    }),
  }));

  return chamadas;
}

const etapa: ContractItem = {
  id: 'ci-1',
  obraId: 'obra-1',
  type: 'etapa',
  code: '1',
  name: 'AC405Lote2',
  unit: 'un',
  contractedQty: 1,
  unitPrice: 0,
  createdAt: 1,
  updatedAt: 1,
} as ContractItem;

beforeEach(() => vi.clearAllMocks());

describe('insertContractItem — garante a extensão da obra antes do insert', () => {
  it('cria a extensão quando a obra só existe no cadastro mestre', async () => {
    const chamadas = montarSupabase(false);

    await insertContractItem(etapa);

    const gravouExtensao = chamadas.find(
      (c) => c.tabela === 'rodotracker_obras' && (c.op === 'upsert' || c.op === 'insert'),
    );
    expect(gravouExtensao, 'extensão da obra precisa ser criada antes do item').toBeTruthy();
    expect(gravouExtensao?.payload).toMatchObject({
      id: 'obra-1',
      name: '007 - AC - 405 Lote 2',
      user_id: 'user-1',
    });

    // A extensão vem ANTES do item — senão a FK derruba do mesmo jeito.
    const iExt = chamadas.findIndex(
      (c) => c.tabela === 'rodotracker_obras' && (c.op === 'upsert' || c.op === 'insert'),
    );
    const iItem = chamadas.findIndex(
      (c) => c.tabela === 'rodotracker_contract_items' && c.op === 'insert',
    );
    expect(iItem).toBeGreaterThan(-1);
    expect(iExt).toBeLessThan(iItem);
  });

  it('LINHA DE CONTROLE: obra que já tem extensão não é regravada', async () => {
    const chamadas = montarSupabase(true);

    await insertContractItem(etapa);

    const gravouExtensao = chamadas.find(
      (c) => c.tabela === 'rodotracker_obras' && (c.op === 'upsert' || c.op === 'insert'),
    );
    expect(gravouExtensao).toBeUndefined();

    // ...e o item entra igual, provando que a asserção acima não é vazia.
    const item = chamadas.find(
      (c) => c.tabela === 'rodotracker_contract_items' && c.op === 'insert',
    );
    expect(item?.payload).toMatchObject({
      id: 'ci-1',
      obra_id: 'obra-1',
      name: 'AC405Lote2',
      type: 'etapa',
      unit: 'un',
    });
  });
});

describe('replaceContractItems — mesma garantia no caminho da importação', () => {
  it('cria a extensão antes do primeiro lote', async () => {
    const chamadas = montarSupabase(false);

    await replaceContractItems('obra-1', [etapa]);

    const iExt = chamadas.findIndex(
      (c) => c.tabela === 'rodotracker_obras' && (c.op === 'upsert' || c.op === 'insert'),
    );
    const iItem = chamadas.findIndex(
      (c) => c.tabela === 'rodotracker_contract_items' && c.op === 'insert',
    );
    expect(iExt).toBeGreaterThan(-1);
    expect(iItem).toBeGreaterThan(-1);
    expect(iExt).toBeLessThan(iItem);
  });
});
