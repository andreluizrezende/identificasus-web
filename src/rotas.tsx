import { Navigate, createBrowserRouter } from 'react-router-dom';
import { Protegida } from '@/componentes/Protegida';
import { Caso } from '@/telas/Caso';
import { Entrar } from '@/telas/Entrar';
import { Fila } from '@/telas/Fila';

export const rotas = [
  { path: '/entrar', element: <Entrar /> },
  { path: '/fila', element: <Protegida><Fila /></Protegida> },
  { path: '/casos/:coCaso', element: <Protegida><Caso /></Protegida> },
  { path: '*', element: <Navigate to="/fila" replace /> },
];

export const roteador = createBrowserRouter(rotas);
