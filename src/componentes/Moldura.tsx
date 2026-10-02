import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { obterSessao, sair } from '@/servicos/sessao';

/**
 * Barra do console: quem está na estação, de qual base, e o "Sair". A área
 * (regulação ou administração) vem da finalidade da conta, e a administração
 * ganha as abas do cadastro.
 */
export function Moldura({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const sessao = obterSessao();
  const administracao = sessao?.finalidade === 'ADMINISTRACAO';

  async function aoSair(): Promise<void> {
    await sair();
    navegar('/entrar', { replace: true });
  }

  return (
    <>
      <header className="barra">
        <div className="barra-marca">
          {/* Sobre plaqueta branca: o manual do SAMU 192 prefere a marca sobre
              branco, e o vermelho do emblema some no fundo escuro da barra. */}
          <span className="placa-samu"><img src="/emblema-samu.svg" alt="SAMU 192" /></span>
          <span>
            IdentificaSUS
            <span className="barra-subtitulo">{administracao ? 'Administração' : 'Central de Regulação'}</span>
          </span>
        </div>
        {administracao && (
          <nav className="barra-abas" aria-label="Cadastro">
            <NavLink to="/admin/profissionais">Profissionais</NavLink>
            <NavLink to="/admin/aparelhos">Aparelhos e estações</NavLink>
          </nav>
        )}
        {sessao && (
          <div className="barra-pessoa">
            {sessao.noUsuario}
            <br />
            <small>
              {sessao.noBase} · <span className="mono">{sessao.coDispositivo}</span>
            </small>
          </div>
        )}
        <button type="button" className="barra-sair" onClick={() => void aoSair()}>
          Sair
        </button>
      </header>
      <main className="conteudo">{children}</main>
    </>
  );
}
