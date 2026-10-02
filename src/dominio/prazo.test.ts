import { describe, expect, it } from 'vitest';
import { nomeDoEstado, situacaoDoPrazo, textoDoPrazo } from './prazo';

describe('prazo', () => {
  it.each([
    [null, 'sem-prazo', 'Sem prazo'],
    [-3, 'vencido', 'Vencido há 3 dias'],
    [-1, 'vencido', 'Venceu ontem'],
    [0, 'hoje', 'Vence hoje'],
    [1, 'proximo', 'Vence amanhã'],
    [2, 'proximo', 'Vence em 2 dias'],
    [3, 'folgado', 'Vence em 3 dias'],
  ])('%s dias → %s, "%s"', (dias, situacao, texto) => {
    expect(situacaoDoPrazo(dias)).toBe(situacao);
    expect(textoDoPrazo(dias)).toBe(texto);
  });

  it('nomeia todos os estados do caso, e devolve o código se surgir um novo', () => {
    expect(nomeDoEstado('ANALISE')).toBe('Em análise');
    expect(nomeDoEstado('ENRIQUECIMENTO')).toBe('Em enriquecimento');
    expect(nomeDoEstado('NOVO_ESTADO')).toBe('NOVO_ESTADO');
  });
});
