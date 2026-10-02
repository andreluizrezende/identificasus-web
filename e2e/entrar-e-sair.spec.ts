import { expect, test } from '@playwright/test';
import { RECUSA_CREDENCIAL, SESSAO, entrarPelaTela, naFila, simularBackend } from './apoio';

test.describe('entrar', () => {
  test('credencial recusada mostra o motivo e continua em entrar', async ({ page }) => {
    await page.route('**/api/sessao', (r) => r.fulfill({ status: 401, json: RECUSA_CREDENCIAL }));
    await entrarPelaTela(page);

    const alerta = page.getByRole('alert');
    await expect(alerta).toContainText(RECUSA_CREDENCIAL.mensagem);
    await expect(alerta).toContainText(RECUSA_CREDENCIAL.acao);
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByLabel('Senha')).toHaveValue('');
  });

  test('o pedido leva e-mail, senha e estação em maiúsculas, e nada mais', async ({ page }) => {
    let corpo: unknown = null;
    await page.route('**/api/sessao', async (r) => {
      corpo = r.request().postDataJSON();
      await r.fulfill({ status: 401, json: RECUSA_CREDENCIAL });
    });
    await entrarPelaTela(page);
    await expect(page.getByRole('alert')).toBeVisible();
    expect(corpo).toEqual({
      ds_email: 'regulacao@example.org',
      senha: 'senha-de-teste-e2e',
      coDispositivo: 'APAR-HOM-0002',
    });
  });

  test('aceita: vai para a fila com nome, base e estação na barra', async ({ page }) => {
    await simularBackend(page);
    await entrarPelaTela(page);
    await naFila(page);

    const barra = page.getByRole('banner');
    await expect(barra).toContainText(SESSAO.usuario.no_usuario);
    await expect(barra).toContainText('Base Centro');
    await expect(barra).toContainText('APAR-HOM-0002');
  });

  test('(!) a sessão fica em sessionStorage, nunca em localStorage', async ({ page }) => {
    await simularBackend(page);
    await entrarPelaTela(page);
    await naFila(page);

    const armazenado = await page.evaluate(() => ({ sessao: sessionStorage.length, local: localStorage.length }));
    expect(armazenado).toEqual({ sessao: 1, local: 0 });
  });

  test('(!) outra aba da mesma estação não herda a sessão', async ({ page, context }) => {
    await simularBackend(page);
    await entrarPelaTela(page);
    await naFila(page);

    const outra = await context.newPage();
    await simularBackend(outra);
    await outra.goto('/fila');
    await expect(outra).toHaveURL(/\/entrar$/);
  });
});

test.describe('rotas protegidas', () => {
  test('sem sessão, o caso manda entrar e, depois de entrar, volta ao caso', async ({ page }) => {
    await simularBackend(page);
    await page.goto('/casos/DEMO-REGUL-0001');
    await expect(page).toHaveURL(/\/entrar$/);

    await page.getByLabel('E-mail').fill('regulacao@example.org');
    await page.getByLabel('Senha').fill('senha-de-teste-e2e');
    await page.getByLabel('Código da estação').fill('APAR-HOM-0002');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/casos\/DEMO-REGUL-0001$/);
    await expect(page.getByRole('heading', { name: 'DEMO-REGUL-0001' })).toBeVisible();
  });

  test('endereço desconhecido cai na fila', async ({ page }) => {
    await simularBackend(page);
    await entrarPelaTela(page);
    await naFila(page);
    await page.goto('/qualquer-coisa');
    await naFila(page);
  });
});

test.describe('sair', () => {
  test('avisa o servidor, apaga a sessão e a fila não abre mais', async ({ page }) => {
    await simularBackend(page);
    let saida: { metodo: string; autorizacao?: string; corpo: unknown } | null = null;
    await page.route('**/api/sessao', async (r) => {
      if (r.request().method() !== 'DELETE') return r.fallback();
      saida = {
        metodo: 'DELETE',
        autorizacao: r.request().headers().authorization,
        corpo: r.request().postDataJSON(),
      };
      await r.fulfill({ status: 204 });
    });

    await entrarPelaTela(page);
    await naFila(page);
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    expect(saida).toEqual({
      metodo: 'DELETE',
      autorizacao: `Bearer ${SESSAO.token}`,
      corpo: { coSessao: SESSAO.coSessao, ds_motivo: 'saida pelo console' },
    });
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);

    await page.goto('/fila');
    await expect(page).toHaveURL(/\/entrar$/);
  });
});
