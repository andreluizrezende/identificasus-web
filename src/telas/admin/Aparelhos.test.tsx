import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Administracao from '@/servicos/administracao';
import type * as Sessao from '@/servicos/sessao';
import { Aparelhos } from './Aparelhos';

const chamadas = vi.fn<(nome: string, ...args: unknown[]) => void>();
let lista: Administracao.Aparelho[] = [];
let respostaDeCadastro: unknown = null;

vi.mock('@/servicos/administracao', async (original) => ({
  ...(await original<typeof Administracao>()),
  buscarAparelhos: async () => lista,
  buscarReferencias: async () => ({
    bases: [{ codigo: 'SAMU-01', nome: 'Norte', ativa: true }, { codigo: 'SAMU-99', nome: 'Antiga', ativa: false }],
    perfis: [],
  }),
  cadastrarAparelho: async (dados: unknown) => {
    chamadas('cadastrar', dados);
    if (respostaDeCadastro instanceof Error) throw respostaDeCadastro;
    return null;
  },
  revogarAparelho: async (codigo: string, motivo: string) => { chamadas('revogar', codigo, motivo); return null; },
}));
vi.mock('@/servicos/sessao', async (original) => ({
  ...(await original<typeof Sessao>()),
  obterSessao: () => ({ coDispositivo: 'EST-0001', finalidade: 'ADMINISTRACAO', noUsuario: 'Adm', noBase: 'Central' }),
}));

const { ErroApi } = await import('@/servicos/administracao');

const TABLET: Administracao.Aparelho = {
  codigo: 'TAB-0001', base: 'SAMU-01', nomeBase: 'Norte', modelo: 'Tablet', ativo: true,
  autorizadoEm: '2026-10-02 12:00:00.000000', revogadoEm: null,
};
const ESTACAO: Administracao.Aparelho = { ...TABLET, codigo: 'EST-0001', modelo: null };

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/admin/aparelhos']}>
      <Routes><Route path="/admin/aparelhos" element={<Aparelhos />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  chamadas.mockReset();
  lista = [TABLET, ESTACAO];
  respostaDeCadastro = null;
});

describe('aparelhos e estações', () => {
  it('autoriza com código em maiúsculas, só em base ativa', async () => {
    const u = userEvent.setup();
    abrir();
    const form = await screen.findByRole('form', { name: 'Autorizar aparelho' });
    expect(within(form).queryByRole('option', { name: /Antiga/ })).not.toBeInTheDocument();
    await u.type(within(form).getByLabelText('Código da etiqueta'), 'tab-0002');
    await u.click(within(form).getByRole('button', { name: 'Autorizar' }));
    expect(chamadas).toHaveBeenCalledWith('cadastrar', { codigo: 'TAB-0002', base: 'SAMU-01', modelo: '' });
    expect(await screen.findByText('Aparelho TAB-0002 autorizado.')).toBeInTheDocument();
  });

  it('código repetido: mensagem do servidor', async () => {
    respostaDeCadastro = new ErroApi(409, 'Já existe um aparelho com este código.', 'codigo');
    const u = userEvent.setup();
    abrir();
    const form = await screen.findByRole('form', { name: 'Autorizar aparelho' });
    await u.type(within(form).getByLabelText('Código da etiqueta'), 'TAB-0001');
    await u.click(within(form).getByRole('button', { name: 'Autorizar' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Já existe um aparelho com este código.');
  });

  it('(!) revogar pede motivo e diz que não tem volta', async () => {
    const u = userEvent.setup();
    abrir();
    const linha = (await screen.findByText('TAB-0001')).closest('tr') as HTMLElement;
    await u.click(within(linha).getByRole('button', { name: 'Revogar' }));
    const grupo = within(linha).getByRole('group', { name: 'Revogar TAB-0001' });
    expect(grupo).toHaveTextContent('não tem volta pela tela');
    const confirmar = within(grupo).getByRole('button', { name: 'Revogar' });
    expect(confirmar).toBeDisabled();
    await u.type(within(grupo).getByLabelText('Motivo'), 'Tablet roubado na base.');
    await u.click(confirmar);
    expect(chamadas).toHaveBeenCalledWith('revogar', 'TAB-0001', 'Tablet roubado na base.');
  });

  it('(!) revogar a própria estação avisa que o próximo login nela não entra', async () => {
    const u = userEvent.setup();
    abrir();
    const linha = (await screen.findByText('esta estação')).closest('tr') as HTMLElement;
    expect(within(linha).getByText('esta estação')).toBeInTheDocument();
    await u.click(within(linha).getByRole('button', { name: 'Revogar' }));
    expect(within(linha).getByText(/É esta estação/)).toBeInTheDocument();
  });

  it('aparelho revogado não oferece revogar de novo', async () => {
    lista = [{ ...TABLET, ativo: false, revogadoEm: '2026-10-01 10:00:00.000000' }];
    abrir();
    const linha = (await screen.findByText('TAB-0001')).closest('tr') as HTMLElement;
    expect(within(linha).getByText(/Revogado em/)).toBeInTheDocument();
    expect(within(linha).queryByRole('button', { name: 'Revogar' })).not.toBeInTheDocument();
  });
});
