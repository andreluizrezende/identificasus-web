import { z } from 'zod';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

const CHAVE = 'identificasus.web.sessao';

/** Renova um minuto antes de vencer, como o app de campo. */
const FOLGA_DE_RENOVACAO_MS = 60_000;

/**
 * (!) `sessionStorage`, E NÃO `localStorage`. O console roda em estação da
 *     central, compartilhada por turno. Fechar a aba encerra o acesso no
 *     navegador: quem senta depois não herda a sessão de quem saiu sem clicar
 *     em "Sair". O app de campo faz o contrário de propósito (72 h offline);
 *     aqui não existe operação sem rede.
 */
const esquemaSessao = z.object({
  token: z.string(),
  renovacao: z.string(),
  expiraEmSegundos: z.number(),
  coSessao: z.string(),
  st_expiracao: z.string(),
  /** Ausente em backend anterior a ela: entao o console nao filtra no login. */
  finalidade: z.string().nullable().optional(),
  usuario: z.object({
    id: z.number(),
    no_usuario: z.string(),
    ds_email: z.string().nullable(),
    perfis: z.array(z.string()),
  }),
  dispositivo: z.object({
    co_dispositivo: z.string(),
    id_base: z.number(),
    no_base: z.string(),
  }),
});

const esquemaGuardado = z.object({
  token: z.string(),
  renovacao: z.string(),
  acessoVenceEm: z.number(),
  coSessao: z.string(),
  stExpiracao: z.string(),
  noUsuario: z.string(),
  perfis: z.array(z.string()),
  noBase: z.string(),
  coDispositivo: z.string(),
  // Sessão guardada antes da área de administração: era sempre da regulação.
  finalidade: z.enum(['ADJUDICACAO', 'ADMINISTRACAO']).default('ADJUDICACAO'),
});
export type SessaoGuardada = z.infer<typeof esquemaGuardado>;

export type ResultadoEntrada =
  | { ok: true }
  | { ok: false; mensagem: string; acao: string };

/**
 * Entrar: a mesma rota do app de campo (`POST /api/sessao`). O "código do
 * aparelho" aqui é o da estação de trabalho da central, cadastrada em
 * mob_dispositivo como qualquer aparelho — estação fora da lista não entra.
 */
export async function entrar(dados: {
  dsEmail: string;
  senha: string;
  coDispositivo: string;
}): Promise<ResultadoEntrada> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/sessao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ds_email: dados.dsEmail,
        senha: dados.senha,
        coDispositivo: dados.coDispositivo,
      }),
    });
  } catch {
    return {
      ok: false,
      mensagem: 'Não consegui falar com o servidor',
      acao: 'Verifique a conexão da estação e tente de novo',
    };
  }

  if (!resposta.ok) return { ok: false, ...(await motivoDaRecusa(resposta)) };

  const lido = esquemaSessao.safeParse(await resposta.json().catch(() => null));
  if (!lido.success) {
    return { ok: false, mensagem: 'Resposta inesperada do servidor', acao: 'Tente novamente em instantes' };
  }
  const s = lido.data;

  // (!) CONTA QUE NAO E DO CONSOLE E RECUSADA AQUI, e nao na fila. Antes a
  //     conta de campo entrava, via "Seu acesso nao e da Central de Regulacao"
  //     na fila e ficava logada num console onde nao podia fazer nada. A
  //     sessao que o servidor acabou de abrir e encerrada na hora.
  const finalidade = finalidadeDoConsole(s.finalidade);
  if (finalidade === null) {
    await encerrarNoServidor(s.token, s.coSessao, 'conta sem finalidade de regulacao ou administracao no console');
    return {
      ok: false,
      mensagem: 'Esta conta não é da Central de Regulação',
      acao: 'Entre com uma conta da regulação ou da administração. A conta de campo é usada no aplicativo do tablet.',
    };
  }

  guardar({
    token: s.token,
    renovacao: s.renovacao,
    acessoVenceEm: Date.now() + s.expiraEmSegundos * 1000,
    coSessao: s.coSessao,
    stExpiracao: s.st_expiracao,
    noUsuario: s.usuario.no_usuario,
    perfis: s.usuario.perfis,
    noBase: s.dispositivo.no_base,
    coDispositivo: s.dispositivo.co_dispositivo,
    finalidade,
  });
  return { ok: true };
}

export function obterSessao(): SessaoGuardada | null {
  const bruto = ler();
  if (!bruto) return null;
  try {
    const lido = esquemaGuardado.safeParse(JSON.parse(bruto));
    return lido.success ? lido.data : null;
  } catch {
    return null;
  }
}

/** Há sessão, e as 72 h dela ainda não passaram. */
export function temSessaoValida(): boolean {
  const s = obterSessao();
  return s !== null && new Date(s.stExpiracao).getTime() > Date.now();
}

const esquemaAcessoRenovado = z.object({ token: z.string(), expiraEmSegundos: z.number() });

/**
 * Troca o token de renovação por um token de acesso novo. Uma renovação de
 * cada vez: chamadas simultâneas esperam a mesma resposta.
 */
let renovacaoEmCurso: Promise<boolean> | null = null;

export function renovarToken(): Promise<boolean> {
  renovacaoEmCurso ??= pedirRenovacao().finally(() => {
    renovacaoEmCurso = null;
  });
  return renovacaoEmCurso;
}

async function pedirRenovacao(): Promise<boolean> {
  const s = obterSessao();
  if (!s || !temSessaoValida()) return false;
  try {
    const r = await fetch(`${BASE}/sessao/renovacao`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ renovacao: s.renovacao }),
    });
    if (!r.ok) return false;
    const lido = esquemaAcessoRenovado.safeParse(await r.json());
    if (!lido.success) return false;
    guardar({ ...s, token: lido.data.token, acessoVenceEm: Date.now() + lido.data.expiraEmSegundos * 1000 });
    return true;
  } catch {
    return false;
  }
}

/** Antes de cada chamada: renova se o token de acesso vence no próximo minuto. */
export async function garantirTokenValido(): Promise<void> {
  const s = obterSessao();
  if (!s) return;
  if (s.acessoVenceEm - FOLGA_DE_RENOVACAO_MS > Date.now()) return;
  await renovarToken();
}

/**
 * As finalidades que este console serve, cada uma com a sua área: a
 * regulação (ADJUDICACAO; fila e casos) e a administração (ADMINISTRACAO;
 * cadastro de profissionais e aparelhos). Uma conta só tem uma finalidade,
 * então quem decide vínculo não cria contas, e quem cria contas não lê casos.
 */
export const FINALIDADES_DO_CONSOLE = ['ADJUDICACAO', 'ADMINISTRACAO'] as const;
export type FinalidadeDoConsole = (typeof FINALIDADES_DO_CONSOLE)[number];

function finalidadeDoConsole(f: string | null | undefined): FinalidadeDoConsole | null {
  // Backend anterior à finalidade na resposta: só existia a regulação.
  if (f === undefined) return 'ADJUDICACAO';
  return FINALIDADES_DO_CONSOLE.find((x) => x === f) ?? null;
}

/** Onde cada área começa, e se um caminho é da área. */
export function inicioDa(finalidade: FinalidadeDoConsole): string {
  return finalidade === 'ADMINISTRACAO' ? '/admin/profissionais' : '/fila';
}
export function caminhoDaArea(caminho: string, finalidade: FinalidadeDoConsole): boolean {
  const deAdministracao = caminho === '/admin' || caminho.startsWith('/admin/');
  return finalidade === 'ADMINISTRACAO' ? deAdministracao : !deAdministracao;
}

/** Encerra uma sessao no servidor; sem rede, ela vence sozinha nas 72 h. */
async function encerrarNoServidor(token: string, coSessao: string, motivo: string): Promise<void> {
  try {
    await fetch(`${BASE}/sessao`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ coSessao, ds_motivo: motivo }),
    });
  } catch {
    /* sem rede: a sessao do servidor vence sozinha nas 72 h */
  }
}

/**
 * Sair: avisa o servidor (que encerra a sessão em mob_sessao e registra na
 * trilha) e apaga a sessão do navegador. A sessão local sai mesmo sem rede:
 * numa estação compartilhada, "sair" tem de tirar o acesso desta tela já.
 */
export async function sair(): Promise<void> {
  const s = obterSessao();
  apagar();
  if (!s) return;
  await encerrarNoServidor(s.token, s.coSessao, 'saida pelo console');
}

/** Esquece a sessão local sem avisar o servidor (ex.: servidor já recusou). */
export function esquecerSessao(): void {
  apagar();
}

// ─────────────────────────────── apoio ───────────────────────────────

async function motivoDaRecusa(r: Response): Promise<{ mensagem: string; acao: string }> {
  const corpo = z.object({ mensagem: z.string(), acao: z.string() })
    .safeParse(await r.json().catch(() => null));
  if (corpo.success) return corpo.data;
  return { mensagem: 'Não foi possível entrar', acao: 'Tente novamente em instantes' };
}

function guardar(s: SessaoGuardada): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(s));
  } catch {
    /* armazenamento indisponível: a sessão vale só até recarregar a página */
  }
}

function ler(): string | null {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function apagar(): void {
  try {
    sessionStorage.removeItem(CHAVE);
  } catch {
    /* nada a apagar */
  }
}
