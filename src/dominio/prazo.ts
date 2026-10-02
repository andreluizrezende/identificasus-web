/**
 * Como a fila apresenta o prazo de um caso. Função pura: a mesma regra serve
 * para a cor da linha e para o texto, e é testada sem tela.
 */
export type SituacaoDoPrazo = 'vencido' | 'hoje' | 'proximo' | 'folgado' | 'sem-prazo';

/** Até quantos dias o prazo conta como "próximo". */
export const DIAS_PROXIMO = 2;

export function situacaoDoPrazo(diasParaPrazo: number | null): SituacaoDoPrazo {
  if (diasParaPrazo === null) return 'sem-prazo';
  if (diasParaPrazo < 0) return 'vencido';
  if (diasParaPrazo === 0) return 'hoje';
  if (diasParaPrazo <= DIAS_PROXIMO) return 'proximo';
  return 'folgado';
}

export function textoDoPrazo(diasParaPrazo: number | null): string {
  if (diasParaPrazo === null) return 'Sem prazo';
  if (diasParaPrazo < -1) return `Vencido há ${-diasParaPrazo} dias`;
  if (diasParaPrazo === -1) return 'Venceu ontem';
  if (diasParaPrazo === 0) return 'Vence hoje';
  if (diasParaPrazo === 1) return 'Vence amanhã';
  return `Vence em ${diasParaPrazo} dias`;
}

/** Nome do estado do caso como a regulação lê (ver ck_mob_caso_st_caso). */
const NOMES_DOS_ESTADOS: Record<string, string> = {
  ABERTO: 'Aberto',
  ENRIQUECIMENTO: 'Em enriquecimento',
  ANALISE: 'Em análise',
  ADJUDICACAO: 'Em adjudicação',
  RESOLVIDO: 'Resolvido',
  NAO_RESOLVIDO: 'Não resolvido',
  PERICIA: 'Em perícia',
  ENCERRADO: 'Encerrado',
};

export function nomeDoEstado(stCaso: string): string {
  return NOMES_DOS_ESTADOS[stCaso] ?? stCaso;
}
