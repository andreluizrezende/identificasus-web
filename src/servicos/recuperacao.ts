import { z } from 'zod';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export const DIGITOS_DO_CODIGO = 6;
/** O servidor exige 10; a tela exige o mesmo para não gastar uma ida até lá. */
export const SENHA_MINIMA = 10;

const esquemaResposta = z.object({ sucesso: z.boolean(), mensagem: z.string(), acao: z.string() });
export type Resposta = z.infer<typeof esquemaResposta> & { ok: boolean };

/**
 * Primeiro acesso e senha esquecida: as mesmas rotas do app de campo
 * (`/sessao/recuperacao`). A conta criada pela administração nasce sem senha,
 * e é aqui que a pessoa define a dela, com um código enviado ao e-mail.
 *
 * (!) ROTAS PÚBLICAS: sem token, porque quem chega aqui não tem sessão. Por
 *     isso não passam por `api.ts`, que anexa o cabeçalho de autorização.
 */
async function postar(caminho: string, corpo: unknown): Promise<Resposta> {
  try {
    const r = await fetch(`${BASE}${caminho}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dados = esquemaResposta.safeParse(await r.json().catch(() => null));
    // O 400 vem do pipe de validação, num formato próprio, sem `acao`.
    if (!dados.success && r.status === 400) {
      return {
        ok: false, sucesso: false, mensagem: 'O servidor recusou os dados',
        acao: `Confira o e-mail, o código e se a senha tem pelo menos ${SENHA_MINIMA} caracteres`,
      };
    }
    if (!dados.success) {
      return { ok: false, sucesso: false, mensagem: 'Resposta inesperada do servidor', acao: 'Tente novamente em instantes' };
    }
    return { ...dados.data, ok: r.ok };
  } catch {
    return { ok: false, sucesso: false, mensagem: 'Não consegui falar com o servidor', acao: 'Verifique a conexão da estação e tente de novo' };
  }
}

export function pedirCodigo(dsEmail: string): Promise<Resposta> {
  return postar('/sessao/recuperacao', { ds_email: dsEmail });
}

export function definirSenha(dados: { dsEmail: string; coCodigo: string; novaSenha: string }): Promise<Resposta> {
  return postar('/sessao/recuperacao/confirmacao', {
    ds_email: dados.dsEmail, co_codigo: dados.coCodigo, nova_senha: dados.novaSenha,
  });
}
