import { expect, test } from '@playwright/test';
import { CASO, FILA, entrarPelaTela, naFila, simularBackend } from './apoio';

test.beforeEach(async ({ page }) => {
  await simularBackend(page);
  await entrarPelaTela(page);
  await naFila(page);
});

test.describe('fila', () => {
  test('lista os casos na ordem do servidor, com prazo legível', async ({ page }) => {
    await expect(page.getByText('2 casos')).toBeVisible();
    const linhas = page.getByRole('row');
    await expect(linhas).toHaveCount(FILA.length + 1); // + cabeçalho

    await expect(linhas.nth(1)).toContainText('Vencido há 2 dias');
    await expect(linhas.nth(1)).toContainText('Em adjudicação');
    await expect(linhas.nth(1)).toContainText('27/09/2026 03:40');
    await expect(linhas.nth(2)).toContainText('Vence amanhã');
    await expect(linhas.nth(2)).toContainText('Em análise');
  });

  test('erro do servidor aparece, e "Atualizar" recupera', async ({ page }) => {
    await page.route('**/api/regulacao/fila', (r) => r.fulfill({ status: 503, json: {} }));
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByRole('alert')).toContainText('O servidor não respondeu agora');

    await page.unroute('**/api/regulacao/fila');
    await simularBackend(page);
    await page.getByRole('button', { name: 'Atualizar' }).click();
    await expect(page.getByText('2 casos')).toBeVisible();
  });
});

test.describe('caso', () => {
  test('o código na fila abre o detalhe completo', async ({ page }) => {
    await page.getByRole('link', { name: CASO.coCaso }).click();
    await expect(page).toHaveURL(/\/casos\/DEMO-REGUL-0001$/);

    await expect(page.getByRole('heading', { name: CASO.coCaso })).toBeVisible();
    await expect(page.getByText('Em análise').first()).toBeVisible();
    await expect(page.getByText(CASO.dsLocal)).toBeVisible();
    await expect(page.getByText(CASO.dsDestino)).toBeVisible();
    await expect(page.getByText('OC-2026-000917')).toBeVisible();
  });

  test('atributos por grupo, com valor, procedência, autor e hora de Salvador', async ({ page }) => {
    await page.goto(`/casos/${CASO.coCaso}`);

    await expect(page.getByRole('heading', { name: 'Características físicas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vestuário e objetos' })).toBeVisible();

    const estatura = page.getByRole('row', { name: /Estatura aproximada/ });
    await expect(estatura).toContainText('1,72');
    await expect(estatura).toContainText('Inferido pela equipe');
    // 01:22 UTC é 22:22 da véspera na central.
    await expect(estatura).toContainText('30/09/2026 22:22');

    const objeto = page.getByRole('row', { name: /Objeto portado/ });
    await expect(objeto).toContainText('Relatado por terceiro');
    await expect(objeto).toContainText('Outra pessoa da equipe');
  });

  test('histórico com transições, motivo e "Sistema" quando não há autor', async ({ page }) => {
    await page.goto(`/casos/${CASO.coCaso}`);
    const historico = page.getByRole('region', { name: 'Histórico' }).getByRole('listitem');
    await expect(historico).toHaveCount(2);
    await expect(historico.nth(0)).toContainText('Aberto');
    await expect(historico.nth(1)).toContainText('Em enriquecimento → Em análise');
    await expect(historico.nth(1)).toContainText('enviado para a regulacao');
    await expect(historico.nth(1)).toContainText('Sistema');
  });

  test('(!) a tela não mostra escore nem candidatos', async ({ page }) => {
    await page.goto(`/casos/${CASO.coCaso}`);
    await expect(page.getByRole('heading', { name: CASO.coCaso })).toBeVisible();
    await expect(page.getByText(/escore\s*\d|candidato\s*\d|% de semelhança/i)).toHaveCount(0);
  });

  test('caso fora da fila: diz isso e oferece voltar', async ({ page }) => {
    await page.goto('/casos/NN-2026-RESOLVIDO');
    await expect(page.getByText('não está na fila da regulação')).toBeVisible();
    await page.getByRole('link', { name: '← Fila' }).click();
    await naFila(page);
  });

  test('sessão encerrada no servidor: volta para entrar e, ao entrar, ao mesmo caso', async ({ page }) => {
    // Token recusado e renovação recusada: a sessão acabou de verdade.
    await page.route('**/api/regulacao/casos/*', (r) => r.fulfill({ status: 401, json: {} }));
    await page.route('**/api/sessao/renovacao', (r) => r.fulfill({ status: 401, json: {} }));
    await page.goto(`/casos/${CASO.coCaso}`);
    await expect(page).toHaveURL(/\/entrar$/);

    await page.unroute('**/api/regulacao/casos/*');
    await simularBackend(page);
    await page.getByLabel('E-mail').fill('regulacao@example.org');
    await page.getByLabel('Senha').fill('senha-de-teste-e2e');
    await page.getByLabel('Código da estação').fill('APAR-HOM-0002');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: CASO.coCaso })).toBeVisible();
  });

  test('dá para chegar ao caso só pelo teclado', async ({ page }) => {
    const link = page.getByRole('link', { name: FILA[0]!.coCaso });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: CASO.coCaso })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: CASO.coCaso })).toBeVisible();
  });
});
