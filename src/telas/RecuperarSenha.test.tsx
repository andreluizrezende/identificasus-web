import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Resposta } from '@/servicos/recuperacao';
import type * as Recuperacao from '@/servicos/recuperacao';
import { RecuperarSenha } from './RecuperarSenha';

const chamadas = vi.fn<(nome: string, dados: unknown) => void>();
const respostaDoPedido: Resposta = { ok: true, sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, o código chega em instantes.', acao: 'Confira a caixa de entrada.' };
let respostaDaSenha: Resposta = { ok: true, sucesso: true, mensagem: 'ok', acao: '' };

vi.mock('@/servicos/recuperacao', async (original) => ({
  ...(await original<typeof Recuperacao>()),
  pedirCodigo: async (email: string) => { chamadas('pedir', email); return respostaDoPedido; },
  definirSenha: async (dados: unknown) => { chamadas('definir', dados); return respostaDaSenha; },
}));

function Entrar() {
  return <p>entrar: {String((useLocation().state as { aviso?: string } | null)?.aviso)}</p>;
}

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/recuperar-senha']}>
      <Routes>
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/entrar" element={<Entrar />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  chamadas.mockReset();
  respostaDaSenha = { ok: true, sucesso: true, mensagem: 'ok', acao: '' };
});

describe('primeiro acesso e senha esquecida', () => {
  it('pede o código, define a senha e volta para entrar com o recado', async () => {
    const u = userEvent.setup();
    abrir();
    await u.type(screen.getByLabelText('E-mail'), ' nova@exemplo.org ');
    await u.click(screen.getByRole('button', { name: 'Enviar código' }));
    expect(chamadas).toHaveBeenCalledWith('pedir', 'nova@exemplo.org');
    expect(await screen.findByRole('status')).toHaveTextContent('Se o e-mail estiver cadastrado');

    await u.type(screen.getByLabelText('Código recebido'), '12a3456');
    await u.type(screen.getByLabelText('Senha nova'), 'frase-longa-de-teste');
    await u.click(screen.getByRole('button', { name: 'Definir senha' }));
    expect(chamadas).toHaveBeenCalledWith('definir', { dsEmail: 'nova@exemplo.org', coCodigo: '123456', novaSenha: 'frase-longa-de-teste' });
    expect(await screen.findByText('entrar: Senha definida. Entre com ela.')).toBeInTheDocument();
  });

  it('(!) senha curta ou igual ao e-mail é barrada sem ir ao servidor', async () => {
    const u = userEvent.setup();
    abrir();
    await u.type(screen.getByLabelText('E-mail'), 'nova@exemplo.org');
    await u.click(screen.getByRole('button', { name: 'Enviar código' }));
    await u.type(await screen.findByLabelText('Código recebido'), '123456');
    await u.type(screen.getByLabelText('Senha nova'), 'curta');
    await u.click(screen.getByRole('button', { name: 'Definir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 10 caracteres');

    await u.clear(screen.getByLabelText('Senha nova'));
    await u.type(screen.getByLabelText('Senha nova'), 'nova@exemplo.org');
    await u.click(screen.getByRole('button', { name: 'Definir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não pode ser o próprio e-mail');
    expect(chamadas).not.toHaveBeenCalledWith('definir', expect.anything());
  });

  it('código errado: mostra o motivo do servidor e fica na tela', async () => {
    respostaDaSenha = { ok: false, sucesso: false, mensagem: 'Código inválido ou vencido', acao: 'Peça outro código' };
    const u = userEvent.setup();
    abrir();
    await u.type(screen.getByLabelText('E-mail'), 'nova@exemplo.org');
    await u.click(screen.getByRole('button', { name: 'Enviar código' }));
    await u.type(await screen.findByLabelText('Código recebido'), '000000');
    await u.type(screen.getByLabelText('Senha nova'), 'frase-longa-de-teste');
    await u.click(screen.getByRole('button', { name: 'Definir senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou vencido');
    expect(screen.getByLabelText('Senha nova')).toHaveValue('');
  });
});
