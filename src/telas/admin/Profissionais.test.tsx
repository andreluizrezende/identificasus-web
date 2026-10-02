import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Administracao from '@/servicos/administracao';
import { Profissionais } from './Profissionais';

// Dublê comum, e não vi.fn devolvendo promessa (ver Caso.test.tsx).
const chamadas = vi.fn<(nome: string, ...args: unknown[]) => void>();
let lista: Administracao.Profissional[] = [];
let respostaDeCriar: { id: number } | Error = { id: 77 };
let respostaDeAlterar: unknown = null;

vi.mock('@/servicos/administracao', async (original) => ({
  ...(await original<typeof Administracao>()),
  buscarProfissionais: async () => lista,
  buscarReferencias: async () => ({
    bases: [{ codigo: 'SAMU-01', nome: 'Norte', ativa: true }],
    perfis: [{ codigo: 'CAMPO', nome: 'Profissional de campo' }, { codigo: 'REGULACAO', nome: 'Regulacao' }],
  }),
  criarProfissional: async (dados: unknown) => {
    chamadas('criar', dados);
    if (respostaDeCriar instanceof Error) throw respostaDeCriar;
    return respostaDeCriar;
  },
  alterarProfissional: async (id: number, dados: unknown) => {
    chamadas('alterar', id, dados);
    if (respostaDeAlterar instanceof Error) throw respostaDeAlterar;
    return null;
  },
}));

const { ErroApi } = await import('@/servicos/administracao');

const ANA: Administracao.Profissional = {
  id: 5, nome: 'Ana Teste', email: 'ana@exemplo.org', cpf: '***.982.247-**', cargo: 'Enfermeira',
  conselho: null, finalidade: 'ASSISTENCIAL', perfis: ['CAMPO'], ativo: true, temSenha: false,
};

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/admin/profissionais']}>
      <Routes><Route path="/admin/profissionais" element={<Profissionais />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  chamadas.mockReset();
  lista = [ANA];
  respostaDeCriar = { id: 77 };
  respostaDeAlterar = null;
});

describe('profissionais', () => {
  it('(!) lista com CPF mascarado e quem ainda não fez o primeiro acesso', async () => {
    abrir();
    const linha = (await screen.findByText('Ana Teste')).closest('tr');
    expect(linha).not.toBeNull();
    const l = within(linha as HTMLElement);
    expect(l.getByText('***.982.247-**')).toBeInTheDocument();
    expect(l.getByText('Campo (aplicativo do tablet)')).toBeInTheDocument();
    expect(l.getByText('aguardando primeiro acesso')).toBeInTheDocument();
  });

  it('(!) cadastra sem campo de senha, e explica o primeiro acesso', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Cadastrar profissional' }));
    const form = screen.getByRole('form', { name: 'Cadastrar profissional' });
    expect(within(form).queryByLabelText(/senha/i)).not.toBeInTheDocument();

    await u.type(within(form).getByLabelText('Nome completo'), 'Bruno Teste');
    await u.type(within(form).getByLabelText('CPF'), '529.982.247-25');
    await u.type(within(form).getByLabelText('E-mail'), 'bruno@exemplo.org');
    await u.selectOptions(within(form).getByLabelText('Finalidade'), 'ADJUDICACAO');
    await u.click(within(form).getByLabelText('Regulacao'));
    await u.click(within(form).getByRole('button', { name: 'Cadastrar' }));

    expect(chamadas).toHaveBeenCalledWith('criar', expect.objectContaining({
      nome: 'Bruno Teste', cpf: '529.982.247-25', email: 'bruno@exemplo.org', finalidade: 'ADJUDICACAO', perfis: ['REGULACAO'],
    }));
    expect(await screen.findByText(/Conta de Bruno Teste criada, sem senha/)).toBeInTheDocument();
  });

  it('CPF repetido: mostra a mensagem do servidor e mantém o formulário', async () => {
    respostaDeCriar = new ErroApi(409, 'Já existe uma conta com este CPF.', 'cpf');
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Cadastrar profissional' }));
    const form = screen.getByRole('form', { name: 'Cadastrar profissional' });
    await u.type(within(form).getByLabelText('Nome completo'), 'Bruno Teste');
    await u.type(within(form).getByLabelText('CPF'), '52998224725');
    await u.type(within(form).getByLabelText('E-mail'), 'bruno@exemplo.org');
    await u.click(within(form).getByRole('button', { name: 'Cadastrar' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('Já existe uma conta com este CPF.');
    expect(within(form).getByLabelText('Nome completo')).toHaveValue('Bruno Teste');
  });

  it('desativar avisa que a pessoa perdeu o acesso', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(chamadas).toHaveBeenCalledWith('alterar', 5, { ativo: false });
    expect(await screen.findByText('Ana Teste foi desativado(a) e perdeu o acesso.')).toBeInTheDocument();
  });

  it('(!) recusa do servidor (ex.: desativar a si mesmo) aparece como aviso', async () => {
    respostaDeAlterar = new ErroApi(400, 'Você não pode desativar a própria conta nem tirar dela a administração. Peça a outra pessoa da administração.');
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Desativar' }));
    expect(await screen.findByText(/não pode desativar a própria conta/)).toBeInTheDocument();
  });

  it('alterar acesso troca finalidade e perfis', async () => {
    const u = userEvent.setup();
    abrir();
    await u.click(await screen.findByRole('button', { name: 'Alterar acesso' }));
    await u.selectOptions(screen.getByLabelText('Finalidade'), 'ADJUDICACAO');
    await u.click(screen.getByLabelText('Profissional de campo'));
    await u.click(screen.getByLabelText('Regulacao'));
    await u.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(chamadas).toHaveBeenCalledWith('alterar', 5, { finalidade: 'ADJUDICACAO', perfis: ['REGULACAO'] });
  });
});
