/**
 * E2E — Engenharia: Cálculos (Onda 5).
 *
 * Cenários cobertos (critérios 5.5):
 *  1. Cria cálculo a partir de pasta de obra → abre editor.
 *  2. `1+1=` preenche resultado 2 no blur.
 *  3. `2*5=11` acende alerta vermelho com `calculado: 10`.
 *  4. Clicar "Alerta revisado" limpa o vermelho, valor persiste.
 *  5. Desligar verificação automática tira o vermelho.
 *  6. Lock 2-usuários — SKIPPED até fixture Onda 8.
 */
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Cálculos', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  async function abrirNovoCalculo(page: import('@playwright/test').Page) {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });
  }

  test('cria cálculo a partir de pasta de obra → abre editor', async ({ page }) => {
    await abrirNovoCalculo(page);
    await expect(page.getByPlaceholder('Título do cálculo')).toBeVisible();
  });

  test('1+1= preenche resultado 2 (no blur)', async ({ page }) => {
    await abrirNovoCalculo(page);
    const linha = page.getByPlaceholder(/Digite uma expressão/i).first();
    await linha.fill('1+1=');
    await linha.blur();
    await expect(linha).toHaveValue('1+1=2');
  });

  test('2*5=11 acende alerta vermelho com calculado=10', async ({ page }) => {
    await abrirNovoCalculo(page);
    const linha = page.getByPlaceholder(/Digite uma expressão/i).first();
    await linha.fill('2*5=11');
    await expect(page.getByText('calculado: 10')).toBeVisible();
    await expect(page.getByRole('button', { name: /Alerta revisado/i })).toBeVisible();
  });

  test('clicar Alerta revisado limpa o vermelho, valor persiste', async ({ page }) => {
    await abrirNovoCalculo(page);
    const linha = page.getByPlaceholder(/Digite uma expressão/i).first();
    await linha.fill('2*5=11');
    await page.getByRole('button', { name: /Alerta revisado/i }).click();
    await expect(page.getByRole('button', { name: /Alerta revisado/i })).not.toBeVisible();
    await expect(linha).toHaveValue('2*5=11');
  });

  test('desligar verificação tira o vermelho', async ({ page }) => {
    await abrirNovoCalculo(page);
    const linha = page.getByPlaceholder(/Digite uma expressão/i).first();
    await linha.fill('2*5=99');
    await expect(page.getByText('calculado: 10')).toBeVisible();
    await page.getByRole('switch', { name: /Verificação automática/i }).click();
    await expect(page.getByText('calculado: 10')).not.toBeVisible();
  });

  test('variável numérica: x=4 depois x*2= → 8', async ({ page }) => {
    await abrirNovoCalculo(page);
    const l1 = page.getByPlaceholder(/Digite uma expressão/i).first();
    await l1.fill('x=4');
    await l1.blur();
    await page.getByRole('button', { name: /Adicionar linha/i }).click();
    const l2 = page.getByPlaceholder(/Digite uma expressão/i).nth(1);
    await l2.fill('x*2=');
    await l2.blur();
    await expect(l2).toHaveValue('x*2=8');
  });

  test('⭐ cenário canônico: x+y+brita4 = 117', async ({ page }) => {
    await abrirNovoCalculo(page);
    const addBtn = page.getByRole('button', { name: /Adicionar linha/i });
    const linha = (n: number) => page.getByPlaceholder(/Digite uma expressão/i).nth(n);

    await linha(0).fill('x=4'); await linha(0).blur();
    await addBtn.click(); await linha(1).fill('y=3'); await linha(1).blur();
    await addBtn.click(); await linha(2).fill('"Brita 4" = 110'); await linha(2).blur();
    await addBtn.click(); await linha(3).fill('x+y+brita4='); await linha(3).blur();

    await expect(linha(3)).toHaveValue('x+y+brita4=117');
  });

  test('palavra reservada: "sin" = 5 rejeitada com erro', async ({ page }) => {
    await abrirNovoCalculo(page);
    const l1 = page.getByPlaceholder(/Digite uma expressão/i).first();
    await l1.fill('"sin" = 5');
    await expect(page.getByText(/reservada/i)).toBeVisible();
  });

  test('lock 2 usuarios — SKIPPED até fixture Onda 8', async () => {
    test.skip(true, 'TODO: requires 2 distinct test users — Onda 8');
  });
});
