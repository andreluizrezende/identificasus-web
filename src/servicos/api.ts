import type { z } from 'zod';
import { garantirTokenValido, obterSessao, renovarToken } from './sessao';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ErroApi extends Error {
  constructor(readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = 'ErroApi';
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
  if (!resposta.ok) throw new ErroApi(resposta.status, textoDoErro(resposta.status));
  return esquema.parse(await resposta.json());
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
