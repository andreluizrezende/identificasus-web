import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarCaso, buscarFila, esquemaCaso } from './regulacao';

const ITEM = {
  coCaso: 'NN-2026-ABCDEFGH', stCaso: 'ANALISE', noBase: 'Base Centro',
  dtOcorrencia: '2026-09-30', hrOcorrencia: '22:15:00', qtCompletude: 64,
  dtPrazo: '2026-10-03', diasParaPrazo: 2,
};
const CASO = {
  ...ITEM, coOcorrenciaSamu: null, dsLocal: null, dsDestino: null, atributos: [], historico: [],
};

const json = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { 'content-type': 'application/json' } });

let fetchFalso: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});
afterEach(() => vi.unstubAllGlobals());

describe('serviço da regulação', () => {
  it('fila vem de /regulacao/fila', async () => {
    fetchFalso.mockResolvedValueOnce(json([ITEM]));
    expect(await buscarFila()).toEqual([ITEM]);
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('/api/regulacao/fila');
  });

  it('o código do caso vai codificado na URL', async () => {
    fetchFalso.mockResolvedValueOnce(json(CASO));
    await buscarCaso('NN/2026 ?x');
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('/api/regulacao/casos/NN%2F2026%20%3Fx');
  });

  it('(!) escore ou candidatos que aparecerem na resposta são descartados', () => {
    // O esquema é a lista do que a tela pode receber. Um campo novo no backend
    // não chega à tela sem alguém mudar este contrato de propósito.
    const lido = esquemaCaso.parse({ ...CASO, escore: 0.93, candidatos: [{ nome: 'X' }] });
    expect(lido).not.toHaveProperty('escore');
    expect(lido).not.toHaveProperty('candidatos');
  });

  it('caso sem campo obrigatório é recusado', () => {
    expect(esquemaCaso.safeParse({ ...CASO, noBase: undefined }).success).toBe(false);
  });
});
