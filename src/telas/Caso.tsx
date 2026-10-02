import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Moldura } from '@/componentes/Moldura';
import { formatarCarimbo, formatarOcorrencia } from '@/dominio/datas';
import { nomeDoEstado, situacaoDoPrazo, textoDoPrazo } from '@/dominio/prazo';
import { ErroApi, buscarCaso } from '@/servicos/regulacao';
import type { Atributo, Caso as DadosDoCaso } from '@/servicos/regulacao';
import { esquecerSessao } from '@/servicos/sessao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; caso: DadosDoCaso }
  | { tipo: 'fora-da-fila' }
  | { tipo: 'erro'; mensagem: string };

/**
 * Detalhe de um caso da fila: o que a equipe registrou em campo, com a
 * procedência e o autor de cada atributo, e o histórico de estados. É o que a
 * regulação lê antes de comparar. Cada abertura desta tela fica na trilha.
 */
export function Caso() {
  const navegar = useNavigate();
  const { coCaso = '' } = useParams();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      setEstado({ tipo: 'pronto', caso: await buscarCaso(coCaso) });
    } catch (erro) {
      // 401 depois da renovação automática: a sessão acabou de verdade.
      if (erro instanceof ErroApi && erro.status === 401) {
        esquecerSessao();
        navegar('/entrar', { replace: true, state: { de: `/casos/${encodeURIComponent(coCaso)}` } });
        return;
      }
      if (erro instanceof ErroApi && erro.status === 404) {
        setEstado({ tipo: 'fora-da-fila' });
        return;
      }
      setEstado({
        tipo: 'erro',
        mensagem: erro instanceof ErroApi ? erro.message : 'Não foi possível abrir o caso.',
      });
    }
  }, [coCaso, navegar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Moldura>
      <Link to="/fila" className="voltar">← Fila</Link>

      {estado.tipo === 'carregando' && <div className="vazio" role="status">Abrindo o caso…</div>}

      {estado.tipo === 'fora-da-fila' && (
        <div className="vazio">
          O caso <span className="mono">{coCaso}</span> não está na fila da regulação.
          Ele pode ainda estar em campo ou já ter sido decidido.
        </div>
      )}

      {estado.tipo === 'erro' && (
        <div className="aviso" role="alert">
          <strong>{estado.mensagem}</strong>
          Se o problema continuar, avise o plantão de TI.
        </div>
      )}

      {estado.tipo === 'pronto' && <Detalhe caso={estado.caso} />}
    </Moldura>
  );
}

function Detalhe({ caso }: { caso: DadosDoCaso }) {
  return (
    <>
      <div className="titulo">
        <h1 className="mono">{caso.coCaso}</h1>
        <span className="etiqueta">{nomeDoEstado(caso.stCaso)}</span>
        <span className={`prazo prazo-${situacaoDoPrazo(caso.diasParaPrazo)}`}>
          {textoDoPrazo(caso.diasParaPrazo)}
        </span>
      </div>
      <p className="subtitulo">
        Registro de campo. Sem escore e sem candidatos: a comparação acontece numa etapa própria.
      </p>

      <section className="painel" aria-labelledby="titulo-ocorrencia">
        <h2 id="titulo-ocorrencia">Ocorrência</h2>
        <dl className="ficha">
          <div><dt>Base</dt><dd>{caso.noBase}</dd></div>
          <div><dt>Data e hora</dt><dd className="mono">{formatarOcorrencia(caso.dtOcorrencia, caso.hrOcorrencia)}</dd></div>
          <div><dt>Ocorrência SAMU</dt><dd className="mono">{caso.coOcorrenciaSamu ?? '—'}</dd></div>
          <div><dt>Completude</dt><dd>{caso.qtCompletude}%</dd></div>
          <div className="ficha-larga"><dt>Local</dt><dd>{caso.dsLocal ?? 'Não informado'}</dd></div>
          <div className="ficha-larga"><dt>Destino</dt><dd>{caso.dsDestino ?? 'Não informado'}</dd></div>
        </dl>
      </section>

      <section className="painel" aria-labelledby="titulo-atributos">
        <h2 id="titulo-atributos">Atributos registrados</h2>
        {caso.atributos.length === 0 ? (
          <p className="painel-vazio">A equipe não registrou atributos neste caso.</p>
        ) : (
          porGrupo(caso.atributos).map(([grupo, atributos]) => (
            <div key={grupo} className="grupo">
              <h3>{grupo}</h3>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Atributo</th>
                    <th>Valor</th>
                    <th>Procedência</th>
                    <th>Registrado por</th>
                    <th>Em</th>
                  </tr>
                </thead>
                <tbody>
                  {atributos.map((a) => (
                    <tr key={a.coAtributo}>
                      <td>{a.noAtributo}</td>
                      <td><strong>{a.valor ?? '—'}</strong></td>
                      <td>{a.dsProcedencia}</td>
                      <td>{a.noAutor}</td>
                      <td className="mono">{formatarCarimbo(a.capturadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>

      <section className="painel" aria-labelledby="titulo-historico">
        <h2 id="titulo-historico">Histórico</h2>
        {caso.historico.length === 0 ? (
          <p className="painel-vazio">Sem transições registradas.</p>
        ) : (
          <ol className="historico">
            {caso.historico.map((t, i) => (
              <li key={`${t.ocorridaEm}-${i}`}>
                <span className="mono historico-quando">{formatarCarimbo(t.ocorridaEm)}</span>
                <span>
                  {t.stAnterior ? `${nomeDoEstado(t.stAnterior)} → ` : ''}
                  <strong>{nomeDoEstado(t.stAtual)}</strong>
                  {t.dsMotivo && <span className="historico-motivo"> · {t.dsMotivo}</span>}
                </span>
                <span className="historico-autor">{t.noAutor ?? 'Sistema'}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

/** Agrupa na ordem em que o servidor mandou (a ordem do protocolo). */
function porGrupo(atributos: Atributo[]): [string, Atributo[]][] {
  const grupos = new Map<string, Atributo[]>();
  for (const a of atributos) {
    const lista = grupos.get(a.noGrupo);
    if (lista) lista.push(a);
    else grupos.set(a.noGrupo, [a]);
  }
  return [...grupos.entries()];
}
