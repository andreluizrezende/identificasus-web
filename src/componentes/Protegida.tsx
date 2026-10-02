import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { inicioDa, obterSessao, temSessaoValida } from '@/servicos/sessao';
import type { FinalidadeDoConsole } from '@/servicos/sessao';

/**
 * Sem sessão válida, manda para "entrar" e lembra para onde a pessoa ia.
 *
 * (!) CADA ÁREA EXIGE A SUA FINALIDADE. A regulação não abre o cadastro, e a
 *     administração não abre a fila: quem chega na área errada vai para o
 *     início da sua. O backend recusa do mesmo jeito (403); isto só evita
 *     mostrar uma tela que não vai funcionar.
 */
export function Protegida({ children, finalidade = 'ADJUDICACAO' }: {
  children: ReactNode;
  finalidade?: FinalidadeDoConsole;
}) {
  const local = useLocation();
  if (!temSessaoValida()) {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }
  const sessao = obterSessao();
  if (sessao && sessao.finalidade !== finalidade) {
    return <Navigate to={inicioDa(sessao.finalidade)} replace />;
  }
  return <>{children}</>;
}
