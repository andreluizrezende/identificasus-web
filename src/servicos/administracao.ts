import { z } from 'zod';
import { requisitar } from './api';

export { ErroApi } from './api';

/**
 * Área de administração (US-34): profissionais, aparelhos e estações.
 * Rotas `/api/admin/*`, só para contas de finalidade ADMINISTRACAO.
 */

export const FINALIDADES = [
  { valor: 'ASSISTENCIAL', rotulo: 'Campo (aplicativo do tablet)' },
  { valor: 'ADJUDICACAO', rotulo: 'Central de Regulação (console)' },
  { valor: 'ADMINISTRACAO', rotulo: 'Administração (console)' },
  { valor: 'AUDITORIA', rotulo: 'Auditoria' },
  { valor: 'PESQUISA', rotulo: 'Pesquisa' },
] as const;
export type CodigoDaFinalidade = (typeof FINALIDADES)[number]['valor'];

export function nomeDaFinalidade(f: string | null): string {
  return FINALIDADES.find((x) => x.valor === f)?.rotulo ?? (f ?? 'Sem finalidade');
}

const esquemaReferencias = z.object({
  bases: z.array(z.object({ codigo: z.string(), nome: z.string(), ativa: z.boolean() })),
  perfis: z.array(z.object({ codigo: z.string(), nome: z.string() })),
});
export type Referencias = z.infer<typeof esquemaReferencias>;

const esquemaProfissional = z.object({
  id: z.number(),
  nome: z.string(),
  email: z.string().nullable(),
  cpf: z.string(),
  cargo: z.string().nullable(),
  conselho: z.string().nullable(),
  finalidade: z.string().nullable(),
  perfis: z.array(z.string()),
  ativo: z.boolean(),
  temSenha: z.boolean(),
});
export type Profissional = z.infer<typeof esquemaProfissional>;

const esquemaAparelho = z.object({
  codigo: z.string(),
  base: z.string(),
  nomeBase: z.string(),
  modelo: z.string().nullable(),
  ativo: z.boolean(),
  autorizadoEm: z.string(),
  revogadoEm: z.string().nullable(),
});
export type Aparelho = z.infer<typeof esquemaAparelho>;

const vazio = z.unknown();

export function buscarReferencias(): Promise<Referencias> {
  return requisitar('/admin/referencias', esquemaReferencias);
}

export function buscarProfissionais(): Promise<Profissional[]> {
  return requisitar('/admin/profissionais', z.array(esquemaProfissional));
}

export interface NovoProfissional {
  nome: string; cpf: string; email: string; cargo: string; conselho: string;
  finalidade: CodigoDaFinalidade; perfis: string[];
}

/** Sem senha: a pessoa define a dela no primeiro acesso (tela "Primeiro acesso"). */
export function criarProfissional(dados: NovoProfissional): Promise<{ id: number }> {
  return requisitar('/admin/profissionais', z.object({ id: z.number() }), {
    method: 'POST', body: JSON.stringify(dados),
  });
}

export function alterarProfissional(
  id: number, dados: { ativo?: boolean; finalidade?: CodigoDaFinalidade; perfis?: string[] },
): Promise<unknown> {
  return requisitar(`/admin/profissionais/${id}`, vazio, { method: 'PATCH', body: JSON.stringify(dados) });
}

export function buscarAparelhos(): Promise<Aparelho[]> {
  return requisitar('/admin/aparelhos', z.array(esquemaAparelho));
}

export function cadastrarAparelho(dados: { codigo: string; base: string; modelo: string }): Promise<unknown> {
  return requisitar('/admin/aparelhos', vazio, { method: 'POST', body: JSON.stringify(dados) });
}

export function revogarAparelho(codigo: string, motivo: string): Promise<unknown> {
  return requisitar(`/admin/aparelhos/${encodeURIComponent(codigo)}/revogar`, vazio, {
    method: 'POST', body: JSON.stringify({ motivo }),
  });
}
