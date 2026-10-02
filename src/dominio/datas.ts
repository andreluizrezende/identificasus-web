/**
 * Datas como a regulação lê. Funções puras, testadas sem tela.
 */

/** A central fica em Salvador; carimbos do servidor são exibidos neste fuso. */
export const FUSO_DA_CENTRAL = 'America/Bahia';

/** "2026-09-30" + "22:15:00" → "30/09/2026 22:15". Sem fuso: é a data do registro. */
export function formatarOcorrencia(data: string, hora: string): string {
  const [a, m, d] = data.slice(0, 10).split('-');
  return `${d}/${m}/${a} ${hora.slice(0, 5)}`;
}

const formatoCarimbo = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_DA_CENTRAL,
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

/**
 * Carimbo do servidor ("2026-09-30 22:20:00.000000", gravado em UTC) no
 * horário da central: "30/09/2026 19:20". Carimbo ilegível volta como veio,
 * em vez de virar uma data errada na tela.
 */
export function formatarCarimbo(carimboUtc: string): string {
  const iso = `${carimboUtc.trim().replace(' ', 'T').slice(0, 23)}Z`;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return carimboUtc;
  return formatoCarimbo.format(data).replace(',', '');
}
