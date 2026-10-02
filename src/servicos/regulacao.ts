import { z } from 'zod';
import { requisitar } from './api';

// As telas tratam o erro da API sem importar o cliente HTTP (regra
// telas-sem-fetch-direto no .dependency-cruiser.cjs).
export { ErroApi } from './api';

/**
 * Item da fila, como o backend devolve (`GET /api/regulacao/fila`,
 * finalidade ADJUDICACAO). Sem local da ocorrência nem atributos: a fila
 * mostra só o que a regulação precisa para escolher por onde começar.
 */
export const esquemaItemDaFila = z.object({
  coCaso: z.string(),
  stCaso: z.string(),
  noBase: z.string(),
  dtOcorrencia: z.string(),
  hrOcorrencia: z.string(),
  qtCompletude: z.number(),
  dtPrazo: z.string().nullable(),
  diasParaPrazo: z.number().nullable(),
});
export type ItemDaFila = z.infer<typeof esquemaItemDaFila>;

export function buscarFila(): Promise<ItemDaFila[]> {
  return requisitar('/regulacao/fila', z.array(esquemaItemDaFila));
}

/** Atributo vigente do caso, com procedência e autor (`GET /api/regulacao/casos/:coCaso`). */
export const esquemaAtributo = z.object({
  coAtributo: z.string(),
  noAtributo: z.string(),
  coGrupo: z.string(),
  noGrupo: z.string(),
  valor: z.string().nullable(),
  coProcedencia: z.string(),
  dsProcedencia: z.string(),
  capturadoEm: z.string(),
  noAutor: z.string(),
});
export type Atributo = z.infer<typeof esquemaAtributo>;

export const esquemaTransicao = z.object({
  stAnterior: z.string().nullable(),
  stAtual: z.string(),
  dsMotivo: z.string().nullable(),
  ocorridaEm: z.string(),
  noAutor: z.string().nullable(),
});
export type Transicao = z.infer<typeof esquemaTransicao>;

/**
 * Detalhe de um caso da fila. Sem escore e sem candidatos: a comparação ainda
 * não existe no backend. O servidor registra cada leitura na trilha.
 */
export const esquemaCaso = esquemaItemDaFila.extend({
  coOcorrenciaSamu: z.string().nullable(),
  dsLocal: z.string().nullable(),
  dsDestino: z.string().nullable(),
  atributos: z.array(esquemaAtributo),
  historico: z.array(esquemaTransicao),
});
export type Caso = z.infer<typeof esquemaCaso>;

export function buscarCaso(coCaso: string): Promise<Caso> {
  return requisitar(`/regulacao/casos/${encodeURIComponent(coCaso)}`, esquemaCaso);
}

/**
 * Foto do caso (`GET /api/regulacao/casos/:coCaso/fotos`). A `url` é de
 * leitura, assinada para aquele arquivo e curta (`validaAte`): o store é
 * privado, e a foto vem direto dele, sem passar pelo backend.
 *
 * (!) SÓ HTTPS. A URL vira `src` de imagem; o esquema recusa qualquer outra
 *     coisa vinda do servidor.
 */
export const esquemaFoto = z.object({
  idMidia: z.number(),
  dsLegenda: z.string().nullable(),
  nuTamanho: z.number(),
  capturadaEm: z.string(),
  noAutor: z.string(),
  url: z.string().url().startsWith('https://'),
  validaAte: z.string(),
});
export type Foto = z.infer<typeof esquemaFoto>;

/** Chamado só quando a tela vai mostrar as fotos: ver foto entra na trilha. */
export function buscarFotos(coCaso: string): Promise<Foto[]> {
  return requisitar(`/regulacao/casos/${encodeURIComponent(coCaso)}/fotos`, z.array(esquemaFoto));
}

/**
 * Decisões que o console já registra (US-31). "Resolvido" depende da
 * comparação de candidatos e da dupla conferência, que ainda não existem.
 */
export const DECISOES = [
  { valor: 'NAO_RESOLVIDO', rotulo: 'Não resolvido', ajuda: 'Buscas esgotadas sem identificar a pessoa.' },
  { valor: 'PERICIA', rotulo: 'Encaminhar à perícia', ajuda: 'O caso segue para identificação pericial, fora do sistema por enquanto.' },
] as const;
export type CodigoDaDecisao = (typeof DECISOES)[number]['valor'];

/** O mesmo mínimo do servidor: um motivo de verdade, e não "ok". */
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 300;

const esquemaDecisaoRegistrada = z.object({ coCaso: z.string(), stCaso: z.string() });
export type DecisaoRegistrada = z.infer<typeof esquemaDecisaoRegistrada>;

/** O autor é quem está na sessão: o servidor o tira do token, nunca do corpo. */
export function decidirCaso(coCaso: string, decisao: CodigoDaDecisao, motivo: string): Promise<DecisaoRegistrada> {
  return requisitar(`/regulacao/casos/${encodeURIComponent(coCaso)}/decisao`, esquemaDecisaoRegistrada, {
    method: 'POST',
    body: JSON.stringify({ decisao, motivo: motivo.trim() }),
  });
}
