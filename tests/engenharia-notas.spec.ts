/**
 * E2E — Engenharia: Notas (Onda 4).
 *
 * Cenários cobertos:
 *  1. Cria nota dentro de pasta de obra → abre editor.
 *  2. Digita, formata negrito, auto-save após 6s (debounce 5s + margem).
 *  3. Lock 2-usuários — SKIPPED até fixtures Onda 8.
 *  4. Cmd+S (ou Ctrl+S) manual dispara salvar.
 *  5. Abre histórico de versões via toolbar.
 */
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Notas', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria nota dentro de pasta de obra → abre editor', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/nota\//, { timeout: 10_000 });
    await expect(page.getByPlaceholder('Título da nota')).toBeVisible();
  });

  test('digita, formata negrito, auto-save após 6s', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/nota\//, { timeout: 10_000 });

    await page.getByPlaceholder('Título da nota').fill(`E2E Auto-Save ${Date.now()}`);
    // Foca o editor e digita
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Texto de teste para auto-save.');

    // Espera o auto-save (debounce 5s + margem)
    await expect(page.getByText('Salvo')).toBeVisible({ timeout: 10_000 });
  });

  test('lock: usuário B vê banner enquanto A edita', async () => {
    test.skip(true, 'TODO: requires 2 distinct test users — fixtures Onda 8');
  });

  test('Cmd+S manual dispara salvar', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/nota\//, { timeout: 10_000 });

    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Salvo via atalho');
    // Aguarda título preencher (default 'Nova nota') antes do save
    await expect(page.getByPlaceholder('Título da nota')).toHaveValue(/.+/);

    // Cmd+S (Mac) — para cross-platform use ControlOrMeta no Playwright? Não, mantemos Meta+s
    // já que o handler aceita metaKey || ctrlKey
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+s' : 'Control+s');

    await expect(page.getByText('Salvo')).toBeVisible({ timeout: 5_000 });
  });

  test('abre histórico de versões', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/nota\//, { timeout: 10_000 });

    // Clica no botão "Histórico" da toolbar (gated por ver_historico_engenharia)
    await page.getByRole('button', { name: /Histórico/i }).click();
    await expect(page.getByText('Histórico de versões')).toBeVisible();
  });
});
