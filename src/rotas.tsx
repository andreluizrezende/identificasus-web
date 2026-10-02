import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Protegida } from '@/componentes/Protegida';
import { Caso } from '@/telas/Caso';
import { Entrar } from '@/telas/Entrar';
import { Fila } from '@/telas/Fila';
import { RecuperarSenha } from '@/telas/RecuperarSenha';
import { Aparelhos } from '@/telas/admin/Aparelhos';
import { Profissionais } from '@/telas/admin/Profissionais';

export const rotas = [
  { path: '/entrar', element: <Entrar /> },
  { path: '/recuperar-senha', element: <RecuperarSenha /> },
  { path: '/fila', element: <Protegida><Fila /></Protegida> },
  { path: '/casos/:coCaso', element: <Protegida><Caso /></Protegida> },
  { path: '/admin/profissionais', element: <Protegida finalidade="ADMINISTRACAO"><Profissionais /></Protegida> },
  { path: '/admin/aparelhos', element: <Protegida finalidade="ADMINISTRACAO"><Aparelhos /></Protegida> },
  { path: '/admin', element: <Navigate to="/admin/profissionais" replace /> },
  { path: '*', element: <Navigate to="/fila" replace /> },
];

export const roteador = createBrowserRouter(rotas);
