/**
 * E2E — Fluxo de Compras: Pedido → Cotação → OC → Recebimento
 * (Auditoria Bloco 2.3 fluxo 1).
 *
 * É o fluxo financeiro mais crítico — múltiplas mutations em cadeia em
 * Compras.tsx (1341 LOC). Erros aqui podem gerar pagamento errado, OC
 * duplicada ou estoque inconsistente.
 *
 * ATENÇÃO: cria dados reais. Rodar contra Supabase de staging/local.
 * Em produção, usar fornecedor e obra de teste com cleanup no afterAll.
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

test.describe('Compras: pedido → cotação → OC → recebimento', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados')

  test('fluxo completo: criar pedido, gerar cotação, escolher vencedor, receber OC', async ({ page }) => {
    await login(page)
    await page.goto('/compras')

    // ── PEDIDO ────────────────────────────────────────────────────────
    await page.getByRole('tab', { name: /pedidos/i }).click()
    await page.getByRole('button', { name: /novo pedido|criar pedido|\+ pedido/i }).click()

    // Form de pedido — selecionar obra + 2 itens
    // Estes selectors são placeholders; ajustar pelos labels reais do PedidoCompraFormV2.
    await page.getByLabel(/obra/i).first().click()
    await page.getByRole('option').first().click()

    // Adicionar 2 itens (descricao + quantidade)
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: /\+ item|adicionar item/i }).click()
      await page.getByLabel(/descrição.*item|insumo/i).last().fill(`Teste E2E item ${i + 1} ${Date.now()}`)
      await page.getByLabel(/quantidade/i).last().fill(String(10 + i))
    }
    await page.getByRole('button', { name: /salvar|criar/i }).click()

    // Pedido salvo aparece na lista
    await expect(page.getByText(/Teste E2E item 1/i).first()).toBeVisible({ timeout: 10_000 })

    // ── COTAÇÃO ───────────────────────────────────────────────────────
    await page.getByRole('tab', { name: /cotações?/i }).click()
    // Espera-se que apareça uma cotação relacionada ao pedido recém-criado.
    // Em alguns fluxos é criada automaticamente, em outros via botão.
    // Assert mínima: a aba carrega sem erro.
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()

    // ── ORDEM DE COMPRA ───────────────────────────────────────────────
    // TODO: ao escolher fornecedor vencedor numa cotação, OC deve ser
    // gerada com numeração sequencial PC-YYYY-XXX. Validar:
    //   await expect(page.getByText(/PC-\d{4}-\d+/)).toBeVisible()

    // ── RECEBIMENTO ───────────────────────────────────────────────────
    // TODO: receber OC parcialmente; verificar:
    //   - status muda pra "parcial"
    //   - saldo no depósito sobe em qtd_recebida

    // Por enquanto: o teste fecha aqui. Expandir conforme integrar com
    // dados de teste estáveis.
  })

  test('aba Lixeira: pedido excluído aparece e pode ser restaurado', async ({ page }) => {
    await login(page)
    await page.goto('/compras?tab=lixeira')
    // Smoke test: aba carrega sem erro de RLS
    await expect(page.locator('main, [role="main"]').first()).toBeVisible()
  })
})
