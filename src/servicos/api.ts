import type { z } from 'zod';
import { garantirTokenValido, obterSessao, renovarToken } from './sessao';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ErroApi extends Error {
  /** Campo do formulário que o servidor apontou (ex.: "cpf"), quando apontou. */
  readonly campo: string | null;

  constructor(readonly status: number, mensagem: string, campo: string | null = null) {
    super(mensagem);
    this.name = 'ErroApi';
    this.campo = campo;
  }
}

/**
 * Único caminho até a rede para rotas autenticadas. Valida a resposta com Zod
 * antes de devolver: nada não verificado entra na tela.
 *
 * Mesma regra do app de campo: renova o token antes de sair se ele estiver
 * vencendo, e se mesmo assim vier 401, renova uma vez e repete. Só depois o
 * 401 chega a quem chamou, e aí significa "entre de novo".
 */
export async function requisitar<S extends z.ZodTypeAny>(
  caminho: string,
  esquema: S,
  init?: RequestInit,
): Promise<z.infer<S>> {
  await garantirTokenValido();
  let resposta = await enviar(caminho, init);
  if (resposta.status === 401 && obterSessao() !== null && (await renovarToken())) {
    resposta = await enviar(caminho, init);
  }
  if (!resposta.ok) {
    const doServidor = resposta.status >= 400 && resposta.status < 500 && resposta.status !== 401 && resposta.status !== 403
      ? await mensagemDoServidor(resposta)
      : null;
    throw new ErroApi(resposta.status, doServidor?.mensagem ?? textoDoErro(resposta.status), doServidor?.campo ?? null);
  }
  // 204 (alterar, revogar) não tem corpo: vira null e passa pelo esquema igual.
  if (resposta.status === 204 || resposta.headers.get('content-length') === '0') return esquema.parse(null);
  return esquema.parse(await resposta.json());
}

/**
 * (!) A MENSAGEM DO SERVIDOR SÓ PASSA SE TIVER O FORMATO DELE ({ mensagem }),
 *     for curta e for de erro do pedido (4xx). "Já existe uma conta com este
 *     CPF" ajuda quem preenche; um texto genérico obrigaria a adivinhar. O
 *     servidor nunca põe dado de caso em mensagem de erro (RNF-07.05).
 */
async function mensagemDoServidor(r: Response): Promise<{ mensagem: string; campo: string | null } | null> {
  const corpo = await r.json().catch(() => null);
  if (typeof corpo !== 'object' || corpo === null) return null;
  const mensagem: unknown = Reflect.get(corpo, 'mensagem');
  const campo: unknown = Reflect.get(corpo, 'campo');
  if (typeof mensagem !== 'string' || mensagem.length === 0 || mensagem.length > 200) return null;
  if (mensagem === 'Requisicao invalida.') return null;
  return { mensagem, campo: typeof campo === 'string' ? campo : null };
}

function enviar(caminho: string, init?: RequestInit): Promise<Response> {
  const token = obterSessao()?.token;
  return fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

function textoDoErro(status: number): string {
  if (status === 401) return 'Sua sessão terminou. Entre novamente para continuar.';
  if (status === 403) return 'Seu acesso não é da Central de Regulação.';
  if (status >= 500) return 'O servidor não respondeu agora. Tente de novo em instantes.';
  return 'Não foi possível concluir a operação.';
}
