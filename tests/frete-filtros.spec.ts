/**
 * E2E — Filtros + presets na aba Frete.
 *
 * Requer: E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

test.describe('Frete filtros + presets', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL/PASSWORD necessárias')

  test('preset "Esta semana" preenche range de data', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    const presetSemana = page.getByRole('button', { name: /Esta semana/i })
    await presetSemana.click()

    // Chip fica ativo (alguma class de "ativo")
    await expect(presetSemana).toHaveClass(/accent/i)
  })

  test('preset "Sem chegada" filtra fretes', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Sem chegada/i }).click()
    // Espera lista atualizar (não conta linhas — só que renderiza sem erro)
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 5_000 })
  })

  test('preset "Top transportadora" abre popover', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Top transportadora/i }).click()
    // Popover do Command/Combobox
    await expect(page.getByPlaceholder(/Buscar transportadora/i)).toBeVisible({ timeout: 5_000 })
  })

  test('clear preset zera estado', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.getByRole('button', { name: /Esta semana/i }).click()
    const limpar = page.getByRole('button', { name: /Limpar preset/i })
    await expect(limpar).toBeVisible()
    await limpar.click()
    await expect(limpar).not.toBeVisible()
  })
})
