/**
 * E2E — Lançamento rápido de atividades (RodoTracker / Medição).
 *
 * Valida que o botão "Lançamento rápido" abre o modal com as 2 abas
 * (CBUQ e TS/Drenos) dentro da MeasurementView de uma obra.
 *
 * Precondição: ter uma obra de teste e seu UUID em E2E_RODOTRACKER_OBRA_ID.
 * Sem ela, o teste é pulado (parecido com checklist-offline.spec.ts).
 *
 * O fluxo completo de paste TSV + salvar é coberto pelos testes unitários
 * (groupCbuqRowsToActivities, groupTsRowsToActivities). Este E2E só garante
 * que o modal monta e renderiza sem crash.
 */
import { test, expect } from '@playwright/test'
import { hasCredentials, login } from './_fixtures'

const obraId = process.env.E2E_RODOTRACKER_OBRA_ID

test.describe('Lançamento rápido — modal abre na MeasurementView', () => {
  test.skip(
    !hasCredentials() || !obraId,
    'E2E_TEST_EMAIL/PASSWORD e E2E_RODOTRACKER_OBRA_ID precisam estar setados'
  )

  test('botão Lançamento rápido abre modal com 2 abas', async ({ page }) => {
    await login(page)

    // Navega direto pra obra (selector da home pode mudar; URL direta é estável)
    await page.goto(`/rodotracker?obra=${obraId}`)

    // Abre a MeasurementView — botão Medição (texto exato pode variar; usa regex)
    await page.getByRole('button', { name: /medi[çc][ãa]o/i }).first().click()

    // Botão "Lançamento rápido" (gated por canEditItens; user de teste precisa
    // ter a ação `editar_itens_contrato`)
    const btn = page.getByRole('button', { name: /lan[çc]amento r[áa]pido/i })
    await expect(btn).toBeVisible({ timeout: 10_000 })
    await btn.click()

    // Modal abriu — verifica título e as 2 abas
    await expect(page.getByText(/lan[çc]amento r[áa]pido —/i)).toBeVisible()
    await expect(page.getByRole('tab', { name: /^CBUQ/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /troca de solo/i })).toBeVisible()

    // Botão "Salvar tudo" existe e está disabled (nada digitado)
    const saveBtn = page.getByRole('button', { name: /salvar tudo/i })
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeDisabled()

    // Botão Cancelar fecha o modal
    await page.getByRole('button', { name: /cancelar/i }).click()
    await expect(page.getByText(/lan[çc]amento r[áa]pido —/i)).not.toBeVisible()
  })

  test('troca de aba preserva conteúdo digitado (smoke)', async ({ page }) => {
    await login(page)
    await page.goto(`/rodotracker?obra=${obraId}`)
    await page.getByRole('button', { name: /medi[çc][ãa]o/i }).first().click()
    await page.getByRole('button', { name: /lan[çc]amento r[áa]pido/i }).click()

    // Digita uma data em CBUQ
    const firstCbuqInput = page.locator('table input').first()
    await firstCbuqInput.fill('21/05/2026')

    // Troca pra aba TS
    await page.getByRole('tab', { name: /troca de solo/i }).click()
    await expect(page.locator('table thead')).toBeVisible()

    // Volta pra CBUQ — valor preservado
    await page.getByRole('tab', { name: /^CBUQ/ }).click()
    await expect(page.locator('table input').first()).toHaveValue('21/05/2026')
  })
})
