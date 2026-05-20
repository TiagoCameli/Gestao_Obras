# Testes E2E (Playwright)

Specs do fluxo de usuário rodando contra um Supabase real. Por padrão **todos os testes pulam** se as variáveis de ambiente abaixo não estiverem setadas (evita CI falhando enquanto não tem ambiente de teste).

## Variáveis necessárias

```bash
# Conta de teste com permissões de admin
export E2E_TEST_EMAIL=teste@example.com
export E2E_TEST_PASSWORD=senha-segura

# Opcional: conta com permissões limitadas (sem 'ver_financeiro')
export E2E_LIMITED_EMAIL=limitado@example.com
export E2E_LIMITED_PASSWORD=outra-senha
```

## Rodando

```bash
# Modo headless (default)
npm run test:e2e

# Modo headed (vê o browser)
npx playwright test --headed

# Um arquivo específico
npx playwright test auth.spec.ts

# Debug interativo
npx playwright test --debug
```

> `npm run test:e2e` ainda **não existe** no `package.json` — adicionar quando integrar ao CI. Por enquanto use `npx playwright test`.

## Especificações

- **`auth.spec.ts`** — login + redirect por permissão + lockout após 5 falhas
- **`compras.spec.ts`** — fluxo completo Pedido → Cotação → OC → Recebimento
- **`checklist-offline.spec.ts`** — checklist mobile com fila offline (IndexedDB)

## Atenção em produção

Esses testes **criam dados reais** (pedidos, cotações, fechaduras de conta).
Recomendado rodar contra um Supabase de staging ou local (`supabase start`).
Se rodar contra produção, configure cleanup (DELETE no afterAll) ou use uma obra/fornecedor exclusivos de teste.
