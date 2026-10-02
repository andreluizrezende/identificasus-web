import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Moldura } from './Moldura';
import { Protegida } from './Protegida';

const CHAVE = 'identificasus.web.sessao';

function guardarSessao(stExpiracao = '2099-01-01T00:00:00.000Z', finalidade = 'ADJUDICACAO'): void {
  sessionStorage.setItem(CHAVE, JSON.stringify({
    token: 'acesso-1', renovacao: 'r', acessoVenceEm: Date.now() + 600_000, coSessao: 'SES-1',
    stExpiracao, noUsuario: 'Regulação de teste', perfis: ['REGULACAO'],
    noBase: 'Base Centro', coDispositivo: 'APAR-HOM-0002', finalidade,
  }));
}

function Entrar() {
  return <p>entrar (de {String((useLocation().state as { de?: string } | null)?.de)})</p>;
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 }))));
afterEach(() => vi.unstubAllGlobals());

describe('Protegida', () => {
  function abrir() {
    render(
      <MemoryRouter initialEntries={['/casos/NN-1']}>
        <Routes>
          <Route path="/casos/:c" element={<Protegida><p>conteúdo do caso</p></Protegida>} />
          <Route path="/entrar" element={<Entrar />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('sem sessão: manda entrar, lembrando o caminho', () => {
    abrir();
    expect(screen.getByText('entrar (de /casos/NN-1)')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo do caso')).not.toBeInTheDocument();
  });

  it('sessão de 72 h vencida conta como sem sessão', () => {
    guardarSessao('2000-01-01T00:00:00.000Z');
    abrir();
    expect(screen.getByText(/^entrar/)).toBeInTheDocument();
  });

  it('com sessão válida: mostra o conteúdo', () => {
    guardarSessao();
    abrir();
    expect(screen.getByText('conteúdo do caso')).toBeInTheDocument();
  });

  it('(!) conta da administração não abre caso: vai para o cadastro', () => {
    guardarSessao(undefined, 'ADMINISTRACAO');
    render(
      <MemoryRouter initialEntries={['/casos/NN-1']}>
        <Routes>
          <Route path="/casos/:c" element={<Protegida><p>conteúdo do caso</p></Protegida>} />
          <Route path="/admin/profissionais" element={<p>cadastro</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('cadastro')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo do caso')).not.toBeInTheDocument();
  });

  it('(!) conta da regulação não abre o cadastro: vai para a fila', () => {
    guardarSessao();
    render(
      <MemoryRouter initialEntries={['/admin/profissionais']}>
        <Routes>
          <Route path="/admin/profissionais" element={<Protegida finalidade="ADMINISTRACAO"><p>cadastro</p></Protegida>} />
          <Route path="/fila" element={<p>fila</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('fila')).toBeInTheDocument();
  });
});

describe('Moldura', () => {
  function abrir() {
    render(
      <MemoryRouter initialEntries={['/fila']}>
        <Routes>
          <Route path="/fila" element={<Moldura><p>miolo</p></Moldura>} />
          <Route path="/entrar" element={<p>tela de entrar</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('mostra quem está na estação, de qual base e qual estação', () => {
    guardarSessao();
    abrir();
    const barra = screen.getByRole('banner');
    expect(barra).toHaveTextContent('Regulação de teste');
    expect(barra).toHaveTextContent('Base Centro');
    expect(barra).toHaveTextContent('APAR-HOM-0002');
    expect(screen.getByText('miolo')).toBeInTheDocument();
  });

  it('na administração, a barra diz "Administração" e mostra as abas do cadastro', () => {
    guardarSessao(undefined, 'ADMINISTRACAO');
    abrir();
    expect(screen.getByRole('banner')).toHaveTextContent('Administração');
    expect(screen.getByRole('link', { name: 'Profissionais' })).toHaveAttribute('href', '/admin/profissionais');
    expect(screen.getByRole('link', { name: 'Aparelhos e estações' })).toBeInTheDocument();
  });

  it('na regulação, sem abas de cadastro', () => {
    guardarSessao();
    abrir();
    expect(screen.queryByRole('navigation', { name: 'Cadastro' })).not.toBeInTheDocument();
  });

  it('"Sair" apaga a sessão e volta para entrar', async () => {
    guardarSessao();
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(await screen.findByText('tela de entrar')).toBeInTheDocument();
    expect(sessionStorage.getItem(CHAVE)).toBeNull();
  });
});
