/**
 * E2E — Drawer (Sheet shadcn) — abre, navega entre sub-tabs, fecha.
 * Foto chegada já está coberta em frete-foto-chegada.spec.ts (Fase A).
 *
 * Requer:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *   E2E_FRETE_SEM_FOTO_ID
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('FreteDetalhesDrawer (Sheet shadcn)', () => {
  test.skip(!hasCredentials() || !freteId, 'env vars necessárias')

  test('abre via row click + fecha via Esc', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator(`tr[data-frete-id="${freteId}"]`).click()

    // Sheet content visível (radix-ui Dialog usa role=dialog)
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.getByText(/Fotos da Chegada da Carga/i)).toBeVisible()

    // Esc fecha
    await page.keyboard.press('Escape')
    await expect(sheet).not.toBeVisible({ timeout: 3_000 })
  })

  test('alterna entre sub-tabs Detalhes e Histórico', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator(`tr[data-frete-id="${freteId}"]`).click()

    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    await sheet.getByRole('button', { name: /^Histórico$/i }).click()
    // Histórico timeline deve aparecer
    await expect(sheet.getByText(/Hist|Timeline|nenhum/i).first()).toBeVisible({ timeout: 5_000 })

    await sheet.getByRole('button', { name: /^Detalhes$/i }).click()
    await expect(sheet.getByText(/Fotos da Chegada da Carga/i)).toBeVisible()
  })
})
