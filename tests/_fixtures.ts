/**
 * Fixtures compartilhados pelos specs E2E.
 *
 * - hasCredentials(): retorna true se E2E_TEST_EMAIL e E2E_TEST_PASSWORD
 *   estiverem setados. Specs usam pra `test.skip(!hasCredentials())`.
 * - login(page): realiza login completo, deixando o app pronto na home.
 *
 * Não compartilhamos storageState entre specs porque cada fluxo precisa
 * validar UI de login/redirect. Para suites maiores, considerar
 * `globalSetup` + `storageState` (https://playwright.dev/docs/auth).
 */
import { Page, expect } from '@playwright/test'

export interface Credentials {
  email: string
  password: string
}

export function hasCredentials(): boolean {
  return !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
}

export function getCredentials(): Credentials {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL e E2E_TEST_PASSWORD precisam estar setados')
  }
  return { email, password }
}

export function hasLimitedCredentials(): boolean {
  return !!(process.env.E2E_LIMITED_EMAIL && process.env.E2E_LIMITED_PASSWORD)
}

export function getLimitedCredentials(): Credentials {
  const email = process.env.E2E_LIMITED_EMAIL
  const password = process.env.E2E_LIMITED_PASSWORD
  if (!email || !password) {
    throw new Error('E2E_LIMITED_EMAIL e E2E_LIMITED_PASSWORD precisam estar setados')
  }
  return { email, password }
}

export async function login(page: Page, creds: Credentials = getCredentials()): Promise<void> {
  await page.goto('/login')
  await page.getByLabel(/e-?mail/i).fill(creds.email)
  await page.getByLabel(/senha/i).fill(creds.password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
}
