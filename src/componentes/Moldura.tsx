import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { obterSessao, sair } from '@/servicos/sessao';

/** Barra do console: quem está na estação, de qual base, e o "Sair". */
export function Moldura({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const sessao = obterSessao();

  async function aoSair(): Promise<void> {
    await sair();
    navegar('/entrar', { replace: true });
  }

  return (
    <>
      <header className="barra">
        <div className="barra-marca">
          IdentificaSUS<span>Central de Regulação</span>
        </div>
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
