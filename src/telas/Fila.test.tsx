import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemDaFila } from '@/servicos/regulacao';
import { Fila } from './Fila';

// Dublê comum, e não vi.fn devolvendo promessa (ver Caso.test.tsx).
let resposta: ItemDaFila[] | Error;
const consultas = vi.fn();

vi.mock('@/servicos/regulacao', async (original) => {
  const real = await original<Record<string, unknown>>();
  return {
    ...real,
    buscarFila: async () => {
      consultas();
      if (resposta instanceof Error) throw resposta;
      return resposta;
    },
  };
});

const { ErroApi } = await import('@/servicos/regulacao');

const ITEM: ItemDaFila = {
  coCaso: 'NN-2026-AAAA', stCaso: 'ADJUDICACAO', noBase: 'Base Centro',
  dtOcorrencia: '2026-09-30', hrOcorrencia: '22:15:00', qtCompletude: 64,
  dtPrazo: '2026-09-29', diasParaPrazo: -2,
};

function Onde() {
  const l = useLocation();
  return <p>em {l.pathname} vindo de {String((l.state as { de?: string } | null)?.de)}</p>;
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/fila']}>
      <Routes>
        <Route path="/fila" element={<Fila />} />
        <Route path="*" element={<Onde />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('tela da fila', () => {
  beforeEach(() => consultas.mockReset());

  it('mostra cada caso com prazo, estado, base, ocorrência e completude', async () => {
    resposta = [ITEM, { ...ITEM, coCaso: 'NN-2026-BBBB', stCaso: 'ANALISE', dtPrazo: null, diasParaPrazo: null }];
    abrir();

    expect(await screen.findByText('2 casos')).toBeInTheDocument();
    const [, primeira, segunda] = screen.getAllByRole('row');
    expect(within(primeira!).getByText('Vencido há 2 dias')).toHaveClass('prazo-vencido');
    expect(within(primeira!).getByText('Em adjudicação')).toBeInTheDocument();
    expect(within(primeira!).getByText('30/09/2026 22:15')).toBeInTheDocument();
    expect(within(primeira!).getByText('64%')).toBeInTheDocument();
    expect(within(segunda!).getByText('Sem prazo')).toBeInTheDocument();
  });

  it('o código do caso leva ao detalhe', async () => {
    resposta = [ITEM];
    abrir();
    await userEvent.click(await screen.findByRole('link', { name: 'NN-2026-AAAA' }));
    expect(await screen.findByText(/em \/casos\/NN-2026-AAAA/)).toBeInTheDocument();
  });

  it('um caso só: "1 caso", no singular', async () => {
    resposta = [ITEM];
    abrir();
    expect(await screen.findByText('1 caso')).toBeInTheDocument();
  });

  it('fila vazia diz isso', async () => {
    resposta = [];
    abrir();
    expect(await screen.findByText('Nenhum caso esperando a regulação agora.')).toBeInTheDocument();
  });

  it('"Atualizar" consulta de novo', async () => {
    resposta = [ITEM];
    abrir();
    await screen.findByText('1 caso');
    resposta = [ITEM, { ...ITEM, coCaso: 'NN-2026-CCCC' }];
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(await screen.findByText('2 casos')).toBeInTheDocument();
    expect(consultas).toHaveBeenCalledTimes(2);
  });

  it('erro do servidor aparece como alerta', async () => {
    resposta = new ErroApi(503, 'O servidor não respondeu agora. Tente de novo em instantes.');
    abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('O servidor não respondeu agora');
  });

  it('sessão encerrada: vai para entrar, lembrando que vinha da fila', async () => {
    resposta = new ErroApi(401, 'x');
    abrir();
    expect(await screen.findByText('em /entrar vindo de /fila')).toBeInTheDocument();
  });
});
