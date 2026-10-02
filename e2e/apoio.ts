import { expect } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

/**
 * Respostas no formato que o identificasus-backend devolve de verdade
 * (sessao.controller.ts e regulacao.service.ts), conferidas contra a API local.
 * O navegador nunca chega ao backend nestes testes: cada rota é atendida aqui.
 */
export const SESSAO = {
  token: 'acesso-e2e',
  renovacao: 'renovacao-e2e',
  expiraEmSegundos: 900,
  coSessao: 'SES-E2E',
  st_expiracao: '2099-01-01T00:00:00.000Z',
  usuario: { id: 50, no_usuario: 'Regulação de teste', ds_email: 'regulacao@example.org', perfis: ['REGULACAO'] },
  dispositivo: { co_dispositivo: 'APAR-HOM-0002', id_base: 1, no_base: 'Base Centro' },
};

export const RECUSA_CREDENCIAL = {
  sucesso: false,
  mensagem: 'E-mail ou senha incorretos',
  acao: 'Confira os dados e tente de novo',
};

export const FILA = [
  {
    coCaso: 'NN-2026-VENCIDO', stCaso: 'ADJUDICACAO', noBase: 'Base Subúrbio',
    dtOcorrencia: '2026-09-27', hrOcorrencia: '03:40:00', qtCompletude: 80,
    dtPrazo: '2026-09-29', diasParaPrazo: -2,
  },
  {
    coCaso: 'DEMO-REGUL-0001', stCaso: 'ANALISE', noBase: 'Base Centro',
    dtOcorrencia: '2026-09-30', hrOcorrencia: '22:15:00', qtCompletude: 55,
    dtPrazo: '2026-10-02', diasParaPrazo: 1,
  },
];

export const CASO = {
  ...FILA[1],
  coOcorrenciaSamu: 'OC-2026-000917',
  dsLocal: 'Av. Sete de Setembro, em frente ao nº 1200, Campo Grande',
  dsDestino: 'Hospital Geral do Estado',
  atributos: [
    {
      coAtributo: 'SEXO_APARENTE', noAtributo: 'Sexo aparente', coGrupo: 'FISICO',
      noGrupo: 'Características físicas', valor: 'Feminino', coProcedencia: 'OBSERVADO',
      dsProcedencia: 'Visto pela equipe durante o atendimento',
      capturadoEm: '2026-10-01 01:20:00.000000', noAutor: 'Equipe de teste',
    },
    {
      coAtributo: 'ESTATURA', noAtributo: 'Estatura aproximada', coGrupo: 'FISICO',
      noGrupo: 'Características físicas', valor: '1,72', coProcedencia: 'ESTIMADO',
      dsProcedencia: 'Inferido pela equipe, como idade e estatura',
      capturadoEm: '2026-10-01 01:22:00.000000', noAutor: 'Equipe de teste',
    },
    {
      coAtributo: 'OBJETO_PORTADO', noAtributo: 'Objeto portado', coGrupo: 'VESTUARIO',
      noGrupo: 'Vestuário e objetos', valor: 'Molho de chaves com chaveiro do Bahia',
      coProcedencia: 'INFORMADO', dsProcedencia: 'Relatado por terceiro: familiar, testemunha',
      capturadoEm: '2026-10-01 01:30:00.000000', noAutor: 'Outra pessoa da equipe',
    },
  ],
  historico: [
    { stAnterior: null, stAtual: 'ABERTO', dsMotivo: 'abertura em campo', ocorridaEm: '2026-10-01 01:15:00.000000', noAutor: 'Equipe de teste' },
    { stAnterior: 'ENRIQUECIMENTO', stAtual: 'ANALISE', dsMotivo: 'enviado para a regulacao', ocorridaEm: '2026-10-01 02:05:00.000000', noAutor: null },
  ],
};

/** Responde 401 se a requisição não trouxer o token da sessão simulada. */
function exigeToken(r: Route): boolean {
  if (r.request().headers().authorization === `Bearer ${SESSAO.token}`) return true;
  void r.fulfill({ status: 401, json: { mensagem: 'Sessão inválida' } });
  return false;
}

/** Backend da regulação simulado: sessão, fila e um caso. */
export async function simularBackend(page: Page): Promise<void> {
  await page.route('**/api/sessao', (r) =>
    r.request().method() === 'DELETE'
      ? r.fulfill({ status: 204 })
      : r.fulfill({ json: SESSAO }));
  await page.route('**/api/regulacao/fila', (r) => exigeToken(r) && r.fulfill({ json: FILA }));
  await page.route('**/api/regulacao/casos/*', (r) => {
    if (!exigeToken(r)) return;
    const pedido = decodeURIComponent(new URL(r.request().url()).pathname.split('/').pop() ?? '');
    return pedido === CASO.coCaso
      ? r.fulfill({ json: CASO })
      : r.fulfill({ status: 404, json: { mensagem: 'Caso não encontrado na fila da regulação.' } });
  });
}

/** Entra pela tela, como a pessoa faria. */
export async function entrarPelaTela(page: Page, caminho = '/entrar'): Promise<void> {
  await page.goto(caminho);
  await page.getByLabel('E-mail').fill('regulacao@example.org');
  await page.getByLabel('Senha').fill('senha-de-teste-e2e');
  await page.getByLabel('Código da estação').fill('apar-hom-0002');
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function naFila(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/fila$/);
  await expect(page.getByRole('heading', { name: 'Fila da regulação' })).toBeVisible();
}
