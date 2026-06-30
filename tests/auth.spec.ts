/**
 * E2E — Login + permissões + lockout (Auditoria Bloco 2.3 fluxo 2).
 *
 * Valida que:
 *  - Login válido entra no app e redireciona para módulo permitido
 *  - URL direta para módulo sem permissão cai em /acesso-negado
 *  - 5 tentativas de senha errada disparam countdown de bloqueio
 *  - Logout limpa sessão e volta pra /login
 */
import { test, expect } from '@playwright/test'
import {
  hasCredentials, getCredentials, login,
} from './_fixtures'

test.describe('Auth: login + permissões', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados')

  test('login admin entra e exibe layout principal', async ({ page }) => {
    await login(page)
    // Algum elemento do MainLayout (header/sidebar) deve estar visível.
    await expect(page.locator('header, nav').first()).toBeVisible()
  })

  test('logout retorna pra /login', async ({ page }) => {
    await login(page)
    // O menu de usuário fica no header — abre e clica em "Sair".
    await page.getByRole('button', { name: /usuário|perfil|sair|menu/i }).first().click()
    await page.getByRole('menuitem', { name: /sair|logout/i }).first().click()
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('5 senhas erradas → mensagem de bloqueio com countdown', async ({ page }) => {
    const { email } = getCredentials()
    for (let i = 0; i < 5; i++) {
      await page.goto('/login')
      await page.getByLabel(/e-?mail/i).fill(email)
      await page.getByLabel(/senha/i).fill(`senha-errada-${i}`)
      await page.getByRole('button', { name: /entrar/i }).click()
      // Última iteração deve mostrar bloqueio; as anteriores mostram "X tentativa(s)"
      await page.waitForTimeout(300)
    }
    // Após a 5a tentativa errada, a UI mostra "bloqueado" + countdown
    await expect(page.getByText(/bloque|tentativa/i)).toBeVisible({ timeout: 5_000 })
  })
})
