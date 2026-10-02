import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { roteador } from './rotas';
import './estilos/global.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Elemento #raiz ausente no index.html');

createRoot(raiz).render(
  <StrictMode>
    <RouterProvider router={roteador} />
  </StrictMode>,
);
