/**
 * E2E — Engenharia: Pastas (Onda 3).
 *
 * Cenários cobertos:
 *  1. Home /engenharia mostra seções "Obras" e "Avulsas".
 *  2. Criar pasta avulsa via dialog.
 *  3. Navegar para uma pasta e criar subpasta via menu "Novo".
 *  4. Soft-delete de pasta avulsa (context-menu — TODO: wiring na Onda 8).
 *  5. Renomear pasta de obra é bloqueado (mostra mensagem de erro).
 *
 * Os cenários 4 e 5 dependem de context-menu/rename UI ainda não wirado na
 * UI principal (a Onda 3 entregou os Dialogs, mas o gatilho de "Renomear" /
 * "Excluir" pelo botão direito ficou para refinamento). Marcados como
 * `test.skip` com TODO para destravar na próxima onda.
 */
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Pastas', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('home /engenharia mostra seções Obras e Avulsas', async ({ page }) => {
    await page.goto('/engenharia');
    await expect(page.getByRole('heading', { name: 'Engenharia', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Obras', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Avulsas', level: 2 })).toBeVisible();
  });

  test('cria pasta avulsa via dialog', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('button', { name: /Nova pasta avulsa/i }).click();
    // Dialog abre — preenche nome
    const nomeUnico = `Templates Estruturais ${Date.now()}`;
    await page.getByLabel('Nome').fill(nomeUnico);
    await page.getByRole('button', { name: /^Criar$/i }).click();
    // O card da pasta nova deve aparecer na home
    await expect(page.getByText(nomeUnico)).toBeVisible({ timeout: 10_000 });
  });

  test('navega para pasta de obra e cria subpasta', async ({ page }) => {
    await page.goto('/engenharia');
    // Espera as obras carregarem; pega o primeiro card de obra (seção "Obras").
    const obrasSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Obras', level: 2 }) });
    const primeiroCardObra = obrasSection.getByRole('button', { name: /Abrir pasta/i }).first();
    await primeiroCardObra.click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);

    // Abre o menu "Novo" e cria subpasta.
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /Subpasta/i }).click();
    const subUnica = `Memorial Estrutural ${Date.now()}`;
    await page.getByLabel('Nome').fill(subUnica);
    await page.getByRole('button', { name: /^Criar$/i }).click();
    await expect(page.getByText(subUnica)).toBeVisible({ timeout: 10_000 });
  });

  // TODO: requires context-menu wiring on FolderCard (Onda 8 / refinamento).
  test.skip('soft-delete pasta avulsa com confirmação', async ({ page }) => {
    await page.goto('/engenharia');
    const nomeUnico = `A Excluir ${Date.now()}`;
    await page.getByRole('button', { name: /Nova pasta avulsa/i }).click();
    await page.getByLabel('Nome').fill(nomeUnico);
    await page.getByRole('button', { name: /^Criar$/i }).click();
    await expect(page.getByText(nomeUnico)).toBeVisible();

    // Context menu via clique direito → "Excluir" → ConfirmDialog.
    await page.getByText(nomeUnico).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Excluir/i }).click();
    await page.getByRole('button', { name: /Confirmar/i }).click();
    await expect(page.getByText(nomeUnico)).not.toBeVisible();
  });

  // TODO: requires "Renomear" entry point on context-menu (Onda 8 / refinamento).
  test.skip('renomear pasta de obra é BLOQUEADO', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Obras', level: 2 }) });
    const primeiroCardObra = obrasSection.getByRole('button', { name: /Abrir pasta/i }).first();
    await primeiroCardObra.click({ button: 'right' });
    const renomearItem = page.getByRole('menuitem', { name: /Renomear/i });
    await renomearItem.click();
    // Dialog mostra mensagem de bloqueio em vez do form.
    await expect(page.getByText(/renomeadas via cadastro de obras/i)).toBeVisible();
  });
});
