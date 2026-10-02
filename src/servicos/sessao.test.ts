import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  caminhoDaArea, entrar, esquecerSessao, garantirTokenValido, inicioDa, obterSessao, renovarToken, sair, temSessaoValida,
} from './sessao';

/** A resposta de `POST /api/sessao`, como o backend devolve. */
function respostaDeSessao(expiraEmSegundos = 900, stExpiracao = '2099-01-01T00:00:00.000Z') {
  return {
    token: 'acesso-1',
    renovacao: 'renovacao-1',
    expiraEmSegundos,
    coSessao: 'SES-1',
    st_expiracao: stExpiracao,
    finalidade: 'ADJUDICACAO' as string | null,
    usuario: { id: 50, no_usuario: 'Regulação', ds_email: 'r@x.org', perfis: ['REGULACAO'] },
    dispositivo: { co_dispositivo: 'APAR-HOM-0002', id_base: 1, no_base: 'Base Centro' },
  };
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

async function entrarComSucesso(expiraEmSegundos?: number, stExpiracao?: string) {
  fetchFalso.mockResolvedValueOnce(json(respostaDeSessao(expiraEmSegundos, stExpiracao)));
  return entrar({ dsEmail: 'r@x.org', senha: 'segredo', coDispositivo: 'APAR-HOM-0002' });
}

describe('entrar', () => {
  it('manda e-mail, senha e estação, e guarda a sessão', async () => {
    expect(await entrarComSucesso()).toEqual({ ok: true });

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/sessao');
    expect(JSON.parse(String(init.body))).toEqual({
      ds_email: 'r@x.org', senha: 'segredo', coDispositivo: 'APAR-HOM-0002',
    });
    expect(obterSessao()).toMatchObject({
      token: 'acesso-1', noUsuario: 'Regulação', noBase: 'Base Centro', coDispositivo: 'APAR-HOM-0002',
    });
  });

  it('guarda em sessionStorage, nunca em localStorage (estação compartilhada)', async () => {
    await entrarComSucesso();
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it('a senha não fica guardada', async () => {
    await entrarComSucesso();
    expect(JSON.stringify(sessionStorage)).not.toContain('segredo');
  });

  it('recusa do servidor devolve o motivo e a ação que ele mandou', async () => {
    fetchFalso.mockResolvedValueOnce(json({ mensagem: 'E-mail ou senha incorretos', acao: 'Confira' }, 401));
    expect(await entrar({ dsEmail: 'a', senha: 'b', coDispositivo: 'c' }))
      .toEqual({ ok: false, mensagem: 'E-mail ou senha incorretos', acao: 'Confira' });
    expect(obterSessao()).toBeNull();
  });

  it('sem rede, diz que é a conexão', async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const r = await entrar({ dsEmail: 'a', senha: 'b', coDispositivo: 'c' });
    expect(r).toMatchObject({ ok: false, mensagem: 'Não consegui falar com o servidor' });
  });

  it('resposta fora do contrato não vira sessão', async () => {
    fetchFalso.mockResolvedValueOnce(json({ token: 'x' }));
    const r = await entrar({ dsEmail: 'a', senha: 'b', coDispositivo: 'c' });
    expect(r).toMatchObject({ ok: false, mensagem: 'Resposta inesperada do servidor' });
    expect(obterSessao()).toBeNull();
  });
});

describe('entrar — so conta da regulacao', () => {
  it('(!) conta de campo e recusada no login, a sessao do servidor e encerrada e nada fica guardado', async () => {
    fetchFalso
      .mockResolvedValueOnce(json({ ...respostaDeSessao(), finalidade: 'ASSISTENCIAL' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const r = await entrar({ dsEmail: 'campo@x.org', senha: 's', coDispositivo: 'APAR-HOM-0001' });

    expect(r).toMatchObject({ ok: false, mensagem: 'Esta conta não é da Central de Regulação' });
    expect(obterSessao()).toBeNull();
    const [url, init] = fetchFalso.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/sessao');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer acesso-1');
  });

  it('backend que ainda nao manda a finalidade continua entrando (compatibilidade)', async () => {
    const semFinalidade: Record<string, unknown> = respostaDeSessao();
    delete semFinalidade.finalidade;
    fetchFalso.mockResolvedValueOnce(json(semFinalidade));
    await expect(entrar({ dsEmail: 'r@x.org', senha: 's', coDispositivo: 'c' })).resolves.toEqual({ ok: true });
    expect(obterSessao()?.finalidade).toBe('ADJUDICACAO');
  });

  it('conta da administração entra, e a sessão guarda a finalidade', async () => {
    fetchFalso.mockResolvedValueOnce(json({ ...respostaDeSessao(), finalidade: 'ADMINISTRACAO' }));
    await expect(entrar({ dsEmail: 'adm@x.org', senha: 's', coDispositivo: 'c' })).resolves.toEqual({ ok: true });
    expect(obterSessao()?.finalidade).toBe('ADMINISTRACAO');
  });

  it('sessão guardada antes da administração existir conta como regulação', () => {
    sessionStorage.setItem('identificasus.web.sessao', JSON.stringify({
      token: 't', renovacao: 'r', acessoVenceEm: 1, coSessao: 's', stExpiracao: '2099-01-01T00:00:00.000Z',
      noUsuario: 'R', perfis: [], noBase: 'B', coDispositivo: 'D',
    }));
    expect(obterSessao()?.finalidade).toBe('ADJUDICACAO');
  });
});

describe('áreas do console', () => {
  it('cada finalidade começa na sua área, e só a sua área conta como dela', () => {
    expect(inicioDa('ADJUDICACAO')).toBe('/fila');
    expect(inicioDa('ADMINISTRACAO')).toBe('/admin/profissionais');
    expect(caminhoDaArea('/casos/NN-1', 'ADJUDICACAO')).toBe(true);
    expect(caminhoDaArea('/admin/aparelhos', 'ADJUDICACAO')).toBe(false);
    expect(caminhoDaArea('/admin/aparelhos', 'ADMINISTRACAO')).toBe(true);
    expect(caminhoDaArea('/fila', 'ADMINISTRACAO')).toBe(false);
    expect(caminhoDaArea('/administrativo', 'ADMINISTRACAO')).toBe(false);
  });
});

describe('validade da sessão', () => {
  it('sem sessão, ou com as 72 h vencidas, não vale', async () => {
    expect(temSessaoValida()).toBe(false);
    await entrarComSucesso(900, '2000-01-01T00:00:00.000Z');
    expect(temSessaoValida()).toBe(false);
  });

  it('sessão adulterada no armazenamento é ignorada', () => {
    sessionStorage.setItem('identificasus.web.sessao', '{"token":1}');
    expect(obterSessao()).toBeNull();
  });
});

describe('renovação do token', () => {
  it('troca o token de acesso e mantém o resto da sessão', async () => {
    await entrarComSucesso();
    fetchFalso.mockResolvedValueOnce(json({ token: 'acesso-2', expiraEmSegundos: 900 }));
    expect(await renovarToken()).toBe(true);
    expect(JSON.parse(String((fetchFalso.mock.calls[1] as [string, RequestInit])[1].body)))
      .toEqual({ renovacao: 'renovacao-1' });
    expect(obterSessao()).toMatchObject({ token: 'acesso-2', coSessao: 'SES-1' });
  });

  it('chamadas simultâneas fazem um pedido só', async () => {
    await entrarComSucesso();
    fetchFalso.mockResolvedValueOnce(json({ token: 'acesso-2', expiraEmSegundos: 900 }));
    const [a, b] = await Promise.all([renovarToken(), renovarToken()]);
    expect([a, b]).toEqual([true, true]);
    expect(fetchFalso).toHaveBeenCalledTimes(2); // entrar + uma renovação
  });

  it('recusa do servidor não renova', async () => {
    await entrarComSucesso();
    fetchFalso.mockResolvedValueOnce(json({}, 401));
    expect(await renovarToken()).toBe(false);
    expect(obterSessao()?.token).toBe('acesso-1');
  });

  it('só renova antes de sair quando falta menos de um minuto', async () => {
    await entrarComSucesso(30); // vence em 30 s
    fetchFalso.mockResolvedValueOnce(json({ token: 'acesso-2', expiraEmSegundos: 900 }));
    await garantirTokenValido();
    expect(obterSessao()?.token).toBe('acesso-2');

    await garantirTokenValido(); // agora com folga: não pede de novo
    expect(fetchFalso).toHaveBeenCalledTimes(2);
  });
});

describe('sair', () => {
  it('avisa o servidor com o token e a sessão, e apaga a sessão local', async () => {
    await entrarComSucesso();
    fetchFalso.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await sair();
    const [url, init] = fetchFalso.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/sessao');
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer acesso-1');
    expect(obterSessao()).toBeNull();
  });

  it('sem rede, a sessão local sai mesmo assim', async () => {
    await entrarComSucesso();
    fetchFalso.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await sair();
    expect(obterSessao()).toBeNull();
  });

  it('esquecer a sessão não fala com o servidor', async () => {
    await entrarComSucesso();
    esquecerSessao();
    expect(obterSessao()).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
});
