import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, requisitar } from './api';

const CHAVE = 'identificasus.web.sessao';

function guardarSessao(token = 'acesso-1', acessoVenceEm = Date.now() + 10 * 60_000): void {
  sessionStorage.setItem(CHAVE, JSON.stringify({
    token, renovacao: 'renovacao-1', acessoVenceEm, coSessao: 'SES-1',
    stExpiracao: '2099-01-01T00:00:00.000Z', noUsuario: 'R', perfis: [], noBase: 'B', coDispositivo: 'D',
  }));
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

const esquema = z.object({ n: z.number() });
let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});
afterEach(() => vi.unstubAllGlobals());

const cabecalhos = (i: number) =>
  (fetchFalso.mock.calls[i] as [string, RequestInit])[1].headers as Record<string, string>;

describe('requisitar', () => {
  it('leva o token e devolve o corpo validado', async () => {
    guardarSessao();
    fetchFalso.mockResolvedValueOnce(json({ n: 1 }));
    expect(await requisitar('/x', esquema)).toEqual({ n: 1 });
    expect(fetchFalso.mock.calls[0]?.[0]).toBe('/api/x');
    expect(cabecalhos(0).authorization).toBe('Bearer acesso-1');
  });

  it('resposta fora do esquema não chega à tela', async () => {
    guardarSessao();
    fetchFalso.mockResolvedValueOnce(json({ n: 'um' }));
    await expect(requisitar('/x', esquema)).rejects.toThrow();
  });

  it('401: renova uma vez e repete com o token novo', async () => {
    guardarSessao();
    fetchFalso
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ token: 'acesso-2', expiraEmSegundos: 900 }))
      .mockResolvedValueOnce(json({ n: 2 }));
    expect(await requisitar('/x', esquema)).toEqual({ n: 2 });
    expect(fetchFalso.mock.calls[1]?.[0]).toBe('/api/sessao/renovacao');
    expect(cabecalhos(2).authorization).toBe('Bearer acesso-2');
  });

  it('401 de novo depois de renovar: chega a quem chamou como 401', async () => {
    guardarSessao();
    fetchFalso
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ token: 'acesso-2', expiraEmSegundos: 900 }))
      .mockResolvedValueOnce(json({}, 401));
    await expect(requisitar('/x', esquema)).rejects.toMatchObject({ status: 401 });
    expect(fetchFalso).toHaveBeenCalledTimes(3); // não entra em laço
  });

  it.each([
    [403, 'Seu acesso não é da Central de Regulação.'],
    [404, 'Não foi possível concluir a operação.'],
    [503, 'O servidor não respondeu agora. Tente de novo em instantes.'],
  ])('%s vira ErroApi com mensagem para a regulação', async (status, mensagem) => {
    guardarSessao();
    fetchFalso.mockResolvedValueOnce(json({}, status));
    const erro: unknown = await requisitar('/x', esquema).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status, message: mensagem });
  });

  it('(!) 409 do cadastro chega com a mensagem do servidor e o campo apontado', async () => {
    guardarSessao();
    fetchFalso.mockResolvedValueOnce(json({ mensagem: 'Já existe uma conta com este CPF.', campo: 'cpf' }, 409));
    const erro: unknown = await requisitar('/x', esquema).catch((e: unknown) => e);
    expect(erro).toMatchObject({ status: 409, message: 'Já existe uma conta com este CPF.', campo: 'cpf' });
  });

  it('mensagem do servidor fora do formato, longa ou do pipe de validação: fica a genérica', async () => {
    guardarSessao();
    fetchFalso
      .mockResolvedValueOnce(json({ mensagem: 'x'.repeat(201) }, 400))
      .mockResolvedValueOnce(json({ mensagem: 'Requisicao invalida.', campos: [] }, 400));
    for (let i = 0; i < 2; i += 1) {
      const erro: unknown = await requisitar('/x', esquema).catch((e: unknown) => e);
      expect(erro).toMatchObject({ status: 400, message: 'Não foi possível concluir a operação.', campo: null });
    }
  });

  it('204 sem corpo passa pelo esquema como null', async () => {
    guardarSessao();
    fetchFalso.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await requisitar('/x', z.null())).toBeNull();
  });
});
