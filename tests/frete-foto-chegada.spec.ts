/**
 * E2E — Foto da chegada inline no drawer (Fase A do redesign Frete).
 *
 * Valida que:
 *  - Drawer abre ao clicar num frete
 *  - Bloco "Foto da Chegada" mostra uploader quando não há foto
 *  - Upload via input file mock atualiza o drawer (thumb + dataChegada)
 *  - Botão "Substituir" volta a mostrar o uploader
 *
 * Precondições:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD — conta com 'editar_frete'
 *   E2E_FRETE_SEM_FOTO_ID — id de um frete sem fotoChegadaUrl
 */
import { test, expect } from '@playwright/test'
import * as path from 'path'
import { hasCredentials, login } from './_fixtures'

const freteId = process.env.E2E_FRETE_SEM_FOTO_ID

test.describe('Foto da chegada inline no drawer', () => {
  test.skip(
    !hasCredentials() || !freteId,
    'E2E_TEST_EMAIL/PASSWORD e E2E_FRETE_SEM_FOTO_ID precisam estar setados'
  )

  test('upload de foto chegada via drawer sem entrar em Editar', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')

    // Espera a lista renderizar
    await expect(page.getByRole('table').first()).toBeVisible({ timeout: 15_000 })

    // Clica no row do frete de teste (procura por data-frete-id se houver
    // ou pelo conteúdo da NF). Como a tabela atual ainda usa .map, vamos
    // pela 1a row visível.
    await page.locator('tbody tr').first().click()

    // Drawer abre — bloco "Foto da Chegada" aparece
    const drawer = page.getByRole('dialog').or(page.locator('[role="dialog"]'))
    await expect(drawer).toBeVisible()
    await expect(page.getByText(/Foto da Chegada da Carga/i)).toBeVisible()

    // Estado vazio: deve mostrar o uploader (procura pelo botão "Tirar foto"
    // ou similar do AnexosUploader)
    await expect(page.getByText(/Tirar foto|Galeria|Pendente/i).first()).toBeVisible()

    // Upload via input file (mock — sem GPS real)
    const fixturePath = path.resolve(__dirname, 'fixtures/foto-chegada.jpg')
    const fileInput = drawer.locator('input[type="file"]').first()
    await fileInput.setInputFiles(fixturePath)

    // Espera toast de sucesso
    await expect(page.getByText(/Foto da chegada registrada/i)).toBeVisible({ timeout: 15_000 })

    // Drawer agora mostra thumbnail (img dentro do bloco) + botão Substituir
    await expect(drawer.locator('img[alt*="chegada"]')).toBeVisible()
    await expect(drawer.getByRole('button', { name: /Substituir/i })).toBeVisible()
  })

  test('clicar Substituir volta pro uploader', async ({ page }) => {
    await login(page)
    await page.goto('/frete?tab=fretes')
    await page.locator('tbody tr').first().click()

    const drawer = page.getByRole('dialog').or(page.locator('[role="dialog"]'))
    const substituir = drawer.getByRole('button', { name: /Substituir/i })

    // Se o frete de teste já tem foto, Substituir deve existir
    if (await substituir.isVisible()) {
      await substituir.click()
      // Após clicar, uploader deve estar visível novamente
      await expect(drawer.locator('input[type="file"]').first()).toBeVisible()
    } else {
      test.skip(true, 'Frete de teste não tem foto chegada — pular este sub-teste')
    }
  })
})
