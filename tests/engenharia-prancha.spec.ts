/**
 * E2E — Engenharia: Prancha (canvas técnico).
 *
 * Cenários cobertos:
 *  1. Cria prancha a partir de pasta de obra → URL /engenharia/prancha/.
 *  2. Ferramenta texto: clica canvas → bloco prancha-texto visível, preenchido.
 *  3. Ferramenta cálculo: clica canvas → bloco prancha-calculo com alerta 2*5=11.
 *  4. Ferramenta retângulo: clica canvas → prancha-forma visível.
 *  5. Salvar → "Salvo" visível.
 *  6. Reload → texto, cálculo e forma ainda visíveis (persistência).
 *
 * NOTA: Este spec NÃO é executado automaticamente enquanto a migration
 * `engenharia_pranchas` não for aplicada ao banco de testes.
 */
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Prancha', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function abrirNovaPrancha(page: import('@playwright/test').Page) {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Prancha$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/prancha\//, { timeout: 10_000 });
  }

  test('criar prancha, inserir texto/cálculo/forma, salvar e reabrir', async ({ page }) => {
    // ── 1. Abrir nova prancha ────────────────────────────────────────────────
    await abrirNovaPrancha(page);

    const canvas = page.getByTestId('prancha-canvas');
    await expect(canvas).toBeVisible();

    // ── 2. Ferramenta texto → bloco prancha-texto ────────────────────────────
    await page.getByTestId('tool-texto').click();
    await canvas.click({ position: { x: 120, y: 100 } });
    const blocoTexto = page.getByTestId('prancha-texto');
    await expect(blocoTexto).toBeVisible();
    await blocoTexto.fill('Viga V1');

    // ── 3. Ferramenta cálculo → prancha-calculo com alerta 2*5=11 ────────────
    await page.getByTestId('tool-calculo').click();
    await canvas.click({ position: { x: 120, y: 240 } });
    const blocoCalculo = page.getByTestId('prancha-calculo');
    await expect(blocoCalculo).toBeVisible();
    const inputCalculo = blocoCalculo.getByRole('textbox').first();
    await inputCalculo.fill('2*5=11');
    await inputCalculo.blur();
    await expect(blocoCalculo).toContainText(/10|erro|⚠/i);

    // ── 4. Ferramenta retângulo → prancha-forma visível ──────────────────────
    await page.getByTestId('tool-retangulo').click();
    await canvas.click({ position: { x: 380, y: 120 } });
    await expect(page.getByTestId('prancha-forma').first()).toBeVisible();

    // ── 5. Salvar ────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /salvar/i }).click();
    await expect(page.getByText(/salvo/i)).toBeVisible();

    // ── 6. Reload → persistência ─────────────────────────────────────────────
    await page.reload();
    await expect(page.getByTestId('prancha-texto')).toBeVisible();
    await expect(page.getByTestId('prancha-calculo')).toBeVisible();
    await expect(page.getByTestId('prancha-forma').first()).toBeVisible();
  });
});
