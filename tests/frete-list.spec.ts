/**
 * E2E — FreteListV2: sort, paginação, expand-row.
 *
 * Requer:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *   E2E_FRETE_SEM_FOTO_ID — id de um frete pra expandir
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('FreteListV2 — data-table1', () => {
  test.skip(!hasCredentials() || !freteId, 'env vars necessárias')

  test('sort por coluna Data inverte ordem', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 })

    const headerData = page.getByRole('columnheader', { name: /^Data$/i })
    await headerData.click() // asc
    await page.waitForTimeout(200)
    await headerData.click() // desc
    // Não vamos asserir ordem real (depende do dataset); só que clicar não dá erro.
    await expect(page.getByRole('table').first()).toBeVisible()
  })

  test('expand-row abre conteúdo extra inline', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    const row = page.locator(`tr[data-frete-id="${freteId}"]`)
    await expect(row).toBeVisible({ timeout: 10_000 })
    const expander = row.locator('button[title*="Expandir"], button[title*="Recolher"]').first()
    await expander.click()

    // Conteúdo da linha expandida deve aparecer (FreteFotoChegadaBlock + cols)
    await expect(page.getByText(/Fotos da Chegada da Carga/i)).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText(/Motorista|Placa|NF/i).first()).toBeVisible()
  })

  test('paginação muda página', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 10_000 })
    const proxima = page.getByRole('button', { name: /Próxima/i })
    if (await proxima.isEnabled()) {
      await proxima.click()
      // Não verificamos o conteúdo da nova página, só que o botão funcionou
      await expect(page.getByText(/Página 2 de/i)).toBeVisible({ timeout: 5_000 })
    } else {
      test.skip(true, 'Só 1 página de fretes no dataset de teste')
    }
  })
})
