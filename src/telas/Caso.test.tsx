import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Regulacao from '@/servicos/regulacao';
import type { Caso as DadosDoCaso } from '@/servicos/regulacao';
import { Caso } from './Caso';

// (!) DUBLÊ COMUM, E NÃO vi.fn DEVOLVENDO PROMESSA REJEITADA. O Vitest 4
//     acompanha a promessa que o vi.fn devolve, e a rejeição reaparece como
//     "não tratada" mesmo com a tela pegando o erro. O vi.fn só anota a chamada.
const chamadas = vi.fn<(coCaso: string) => void>();
let resposta: DadosDoCaso | Error;

vi.mock('@/servicos/regulacao', async (original) => ({
  ...(await original<typeof Regulacao>()),
  buscarCaso: async (coCaso: string) => {
    chamadas(coCaso);
    if (resposta instanceof Error) throw resposta;
    return resposta;
  },
}));

const { ErroApi } = await import('@/servicos/regulacao');

const CASO: DadosDoCaso = {
  coCaso: 'NN-2026-ABCDEFGH', stCaso: 'ANALISE', noBase: 'Base Centro',
  dtOcorrencia: '2026-09-30', hrOcorrencia: '22:15:00', qtCompletude: 64,
  dtPrazo: '2026-10-03', diasParaPrazo: 2,
  coOcorrenciaSamu: 'OC-123', dsLocal: 'Av. Sete, 100', dsDestino: null,
  atributos: [
    {
      coAtributo: 'SEXO', noAtributo: 'Sexo', coGrupo: 'FISICO', noGrupo: 'Características físicas',
      valor: 'Masculino', coProcedencia: 'OBSERVADO', dsProcedencia: 'Observado pela equipe',
      capturadoEm: '2026-10-01 01:20:00.000000', noAutor: 'Ana',
    },
    {
      coAtributo: 'TATUAGEM', noAtributo: 'Tatuagem', coGrupo: 'SINAIS', noGrupo: 'Sinais particulares',
      valor: 'Antebraço direito', coProcedencia: 'INFORMADO', dsProcedencia: 'Informado por terceiro',
      capturadoEm: '2026-10-01 01:25:00.000000', noAutor: 'Bruno',
    },
  ],
  historico: [{
    stAnterior: 'ENRIQUECIMENTO', stAtual: 'ANALISE', dsMotivo: 'enviado para a regulacao',
    ocorridaEm: '2026-10-01 02:00:00.000000', noAutor: null,
  }],
};

function abrir(coCaso = 'NN-2026-ABCDEFGH') {
  return render(
    <MemoryRouter initialEntries={[`/casos/${coCaso}`]}>
      <Routes>
        <Route path="/casos/:coCaso" element={<Caso />} />
        <Route path="/entrar" element={<p>tela de entrar</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('tela do caso', () => {
  beforeEach(() => chamadas.mockReset());

  it('mostra ocorrência, atributos por grupo com procedência e autor, e o histórico', async () => {
    resposta = CASO;
    abrir();

    expect(await screen.findByRole('heading', { name: 'NN-2026-ABCDEFGH' })).toBeInTheDocument();
    expect(chamadas).toHaveBeenCalledWith('NN-2026-ABCDEFGH');
    expect(screen.getByText('Av. Sete, 100')).toBeInTheDocument();
    expect(screen.getByText('Vence em 2 dias')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Características físicas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sinais particulares' })).toBeInTheDocument();
    expect(screen.getByText('Informado por terceiro')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    // Carimbo em UTC exibido no horário da central.
    expect(screen.getByText('30/09/2026 22:20')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('não mostra escore nem candidatos', async () => {
    resposta = CASO;
    abrir();
    await screen.findByRole('heading', { name: 'NN-2026-ABCDEFGH' });
    expect(screen.queryByText(/escore\s*:|candidato\s*\d/i)).not.toBeInTheDocument();
  });

  it('caso fora da fila: diz isso, sem detalhar', async () => {
    resposta = new ErroApi(404, 'x');
    abrir();
    expect(await screen.findByText(/não está na fila da regulação/)).toBeInTheDocument();
  });

  it('sessão encerrada: volta para entrar', async () => {
    resposta = new ErroApi(401, 'x');
    abrir();
    expect(await screen.findByText('tela de entrar')).toBeInTheDocument();
  });

  it('servidor fora: mostra o erro', async () => {
    resposta = new ErroApi(503, 'O servidor não respondeu agora. Tente de novo em instantes.');
    abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('O servidor não respondeu agora');
  });
});
