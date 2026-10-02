import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moldura } from '@/componentes/Moldura';
import { formatarOcorrencia } from '@/dominio/datas';
import { nomeDoEstado, situacaoDoPrazo, textoDoPrazo } from '@/dominio/prazo';
import { ErroApi, buscarFila } from '@/servicos/regulacao';
import type { ItemDaFila } from '@/servicos/regulacao';
import { esquecerSessao } from '@/servicos/sessao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronta'; itens: ItemDaFila[] }
  | { tipo: 'erro'; mensagem: string };

/**
 * Fila da Central de Regulação: casos em análise ou adjudicação, do prazo mais
 * apertado para o mais folgado. É por onde a regulação escolhe o próximo caso.
 */
export function Fila() {
  const navegar = useNavigate();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      setEstado({ tipo: 'pronta', itens: await buscarFila() });
    } catch (erro) {
      // 401 depois da renovação automática: a sessão acabou de verdade.
      if (erro instanceof ErroApi && erro.status === 401) {
        esquecerSessao();
        navegar('/entrar', { replace: true, state: { de: '/fila' } });
        return;
      }
      setEstado({
        tipo: 'erro',
        mensagem: erro instanceof ErroApi ? erro.message : 'Não foi possível carregar a fila.',
      });
    }
  }, [navegar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Moldura>
      <div className="titulo">
        <h1>Fila da regulação</h1>
        {estado.tipo === 'pronta' && (
          <span className="titulo-contagem">
            {estado.itens.length === 1 ? '1 caso' : `${estado.itens.length} casos`}
          </span>
        )}
        <button
          type="button" className="botao-secundario titulo-acao"
          disabled={estado.tipo === 'carregando'} onClick={() => void carregar()}
        >
          Atualizar
        </button>
      </div>
      <p className="subtitulo">Casos em análise ou adjudicação, do prazo mais apertado para o mais folgado.</p>

      {estado.tipo === 'carregando' && <div className="vazio" role="status">Carregando a fila…</div>}

      {estado.tipo === 'erro' && (
        <div className="aviso" role="alert">
          <strong>{estado.mensagem}</strong>
          Se o problema continuar, avise o plantão de TI.
        </div>
      )}

      {estado.tipo === 'pronta' && estado.itens.length === 0 && (
        <div className="vazio">Nenhum caso esperando a regulação agora.</div>
      )}

      {estado.tipo === 'pronta' && estado.itens.length > 0 && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Prazo</th>
              <th>Caso</th>
              <th>Estado</th>
              <th>Base</th>
              <th>Ocorrência</th>
              <th>Completude</th>
            </tr>
          </thead>
          <tbody>
            {estado.itens.map((item) => (
              <tr key={item.coCaso}>
                <td>
                  <span className={`prazo prazo-${situacaoDoPrazo(item.diasParaPrazo)}`}>
                    {textoDoPrazo(item.diasParaPrazo)}
                  </span>
                </td>
                <td className="mono">
                  <Link to={`/casos/${encodeURIComponent(item.coCaso)}`}>{item.coCaso}</Link>
                </td>
                <td>{nomeDoEstado(item.stCaso)}</td>
                <td>{item.noBase}</td>
                <td className="mono">{formatarOcorrencia(item.dtOcorrencia, item.hrOcorrencia)}</td>
                <td>
                  <span className="completude" title={`${item.qtCompletude}% dos atributos preenchidos`}>
                    <span className="completude-barra"><i style={{ width: `${item.qtCompletude}%` }} /></span>
                    {item.qtCompletude}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Moldura>
  );
}

