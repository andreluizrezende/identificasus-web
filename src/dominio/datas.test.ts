import { describe, expect, it } from 'vitest';
import { formatarCarimbo, formatarOcorrencia } from './datas';

describe('datas', () => {
  it('ocorrência é a data do registro, sem fuso', () => {
    expect(formatarOcorrencia('2026-09-30', '22:15:00')).toBe('30/09/2026 22:15');
  });

  it('carimbo do servidor (UTC) aparece no horário de Salvador', () => {
    expect(formatarCarimbo('2026-09-30 22:20:00.000000')).toBe('30/09/2026 19:20');
    // Virada de dia: 01:30 UTC ainda é a noite anterior na central.
    expect(formatarCarimbo('2026-10-01 01:30:00')).toBe('30/09/2026 22:30');
  });

  it('carimbo ilegível volta como veio, em vez de virar data errada', () => {
    expect(formatarCarimbo('ontem')).toBe('ontem');
  });
});
