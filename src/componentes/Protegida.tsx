import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { temSessaoValida } from '@/servicos/sessao';

/** Sem sessão válida, manda para "entrar" e lembra para onde a pessoa ia. */
export function Protegida({ children }: { children: ReactNode }) {
  const local = useLocation();
  if (!temSessaoValida()) {
    return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  }
  return <>{children}</>;
}
