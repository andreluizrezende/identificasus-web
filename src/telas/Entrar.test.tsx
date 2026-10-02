import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultadoEntrada } from '@/servicos/sessao';
import type * as Sessao from '@/servicos/sessao';
import { Entrar } from './Entrar';

// Dublê comum, e não vi.fn devolvendo promessa (ver Caso.test.tsx).
const pedidos = vi.fn<(dados: unknown) => void>();
let resultado: ResultadoEntrada = { ok: true };
let finalidadeDaConta: 'ADJUDICACAO' | 'ADMINISTRACAO' = 'ADJUDICACAO';

vi.mock('@/servicos/sessao', async (original) => ({
  ...(await original<typeof Sessao>()),
  entrar: async (dados: unknown) => {
    pedidos(dados);
    return resultado;
  },
  obterSessao: () => ({ finalidade: finalidadeDaConta }),
}));

function Destino() {
  return <p>destino: {useLocation().pathname}</p>;
}

function abrir(de?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/entrar', state: de === undefined ? null : { de } }]}>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencher() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('E-mail'), '  r@x.org ');
  await u.type(screen.getByLabelText('Senha'), 'segredo');
  await u.type(screen.getByLabelText('Código da estação'), 'apar-hom-0002');
  await u.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('tela de entrar', () => {
  beforeEach(() => {
    pedidos.mockReset();
    resultado = { ok: true };
    finalidadeDaConta = 'ADJUDICACAO';
  });

  it('(!) conta da administração vai para o cadastro, mesmo que ia para a fila', async () => {
    finalidadeDaConta = 'ADMINISTRACAO';
    abrir('/fila');
    await preencher();
    expect(await screen.findByText('destino: /admin/profissionais')).toBeInTheDocument();
  });

  it('conta da administração volta para onde ia, se for do cadastro', async () => {
    finalidadeDaConta = 'ADMINISTRACAO';
    abrir('/admin/aparelhos');
    await preencher();
    expect(await screen.findByText('destino: /admin/aparelhos')).toBeInTheDocument();
  });

  it('(!) conta da regulação não volta para o cadastro: vai para a fila', async () => {
    abrir('/admin/profissionais');
    await preencher();
    expect(await screen.findByText('destino: /fila')).toBeInTheDocument();
  });

  it('o recado de senha definida aparece', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/entrar', state: { aviso: 'Senha definida. Entre com ela.' } }]}>
        <Routes><Route path="/entrar" element={<Entrar />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Senha definida. Entre com ela.');
    expect(screen.getByRole('link', { name: 'Primeiro acesso ou esqueceu a senha?' })).toHaveAttribute('href', '/recuperar-senha');
  });

  it('manda e-mail sem espaços, senha e estação em maiúsculas, e vai para a fila', async () => {
    abrir();
    await preencher();
    expect(pedidos).toHaveBeenCalledWith({ dsEmail: 'r@x.org', senha: 'segredo', coDispositivo: 'APAR-HOM-0002' });
    expect(await screen.findByText('destino: /fila')).toBeInTheDocument();
  });

  it('volta para onde a pessoa ia antes de a sessão acabar', async () => {
    abrir('/casos/NN-1');
    await preencher();
    expect(await screen.findByText('destino: /casos/NN-1')).toBeInTheDocument();
  });

  it.each<{ de: unknown; porque: string }>([
    { de: 'https://fora.example', porque: 'esquema' },
    { de: '//fora.example', porque: 'protocolo relativo' },
    { de: '/entrar', porque: 'a própria tela' },
    { de: 42, porque: 'valor que não é texto' },
  ])('(!) "de" forjado ($porque) cai na fila, e não vira redirecionamento aberto', async ({ de }) => {
    abrir(de);
    await preencher();
    expect(await screen.findByText('destino: /fila')).toBeInTheDocument();
  });

  it('recusa mostra motivo e ação, fica na tela e limpa a senha', async () => {
    resultado = { ok: false, mensagem: 'E-mail ou senha incorretos', acao: 'Confira os dados' };
    abrir();
    await preencher();
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('E-mail ou senha incorretos');
    expect(alerta).toHaveTextContent('Confira os dados');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
    expect(screen.getByLabelText('E-mail')).toHaveValue('r@x.org'); // o e-mail fica para tentar de novo
  });
});

describe('acessibilidade da tela de entrar', () => {
  it('o campo da estação se chama só "Código da estação", e a ajuda é a descrição', () => {
    abrir();
    const campo = screen.getByRole('textbox', { name: 'Código da estação' });
    expect(campo).toHaveAccessibleDescription(/Está na etiqueta do computador/);
  });
});
