import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Moldura } from '@/componentes/Moldura';
import { formatarCarimbo, formatarOcorrencia } from '@/dominio/datas';
import { nomeDoEstado, situacaoDoPrazo, textoDoPrazo } from '@/dominio/prazo';
import {
  DECISOES, ErroApi, MOTIVO_MAXIMO, MOTIVO_MINIMO, buscarCaso, buscarFotos, decidirCaso,
} from '@/servicos/regulacao';
import type { Atributo, CodigoDaDecisao, Caso as DadosDoCaso, Foto } from '@/servicos/regulacao';
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

      {estado.tipo === 'pronto' && (
        <Detalhe
          caso={estado.caso}
          aoDecidir={(stCaso) => setEstado({ tipo: 'pronto', caso: { ...estado.caso, stCaso } })}
        />
      )}
    </Moldura>
  );
}

function Detalhe({ caso, aoDecidir }: { caso: DadosDoCaso; aoDecidir: (stCaso: string) => void }) {
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

      <Fotos coCaso={caso.coCaso} />

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

      <Decidir coCaso={caso.coCaso} aoDecidir={aoDecidir} />
    </>
  );
}

type EstadoDaDecisao =
  | { tipo: 'editando'; erro: string | null }
  | { tipo: 'enviando' }
  | { tipo: 'feita'; stCaso: string };

/**
 * Decisão do caso (US-31): tira o caso da fila com motivo e autor.
 *
 * (!) SÓ "NÃO RESOLVIDO" E "PERÍCIA". "Resolvido" diz a quem o caso foi
 *     vinculado, e isso só existe com a comparação de candidatos e a dupla
 *     conferência; a tela diz isso em vez de esconder a opção.
 *
 * (!) MOTIVO OBRIGATÓRIO, com o mesmo mínimo do servidor. Ele vai para o
 *     histórico do caso, com o autor; o botão só libera com o motivo.
 *
 * (!) DEPOIS DE DECIDIR, O CASO SAI DA FILA: a tela confirma e leva de volta,
 *     em vez de continuar mostrando um caso que já não é da central.
 */
function Decidir({ coCaso, aoDecidir }: { coCaso: string; aoDecidir: (stCaso: string) => void }) {
  const [decisao, setDecisao] = useState<CodigoDaDecisao | null>(null);
  const [motivo, setMotivo] = useState('');
  const [estado, setEstado] = useState<EstadoDaDecisao>({ tipo: 'editando', erro: null });
  const tamanho = motivo.trim().length;
  const pronto = decisao !== null && tamanho >= MOTIVO_MINIMO && tamanho <= MOTIVO_MAXIMO;

  async function registrar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!pronto || decisao === null) return;
    setEstado({ tipo: 'enviando' });
    try {
      const r = await decidirCaso(coCaso, decisao, motivo);
      setEstado({ tipo: 'feita', stCaso: r.stCaso });
      // O selo do topo passa a dizer o estado novo, e nao "Em analise".
      aoDecidir(r.stCaso);
    } catch (erro) {
      let texto = 'Não foi possível registrar a decisão. Tente de novo.';
      if (erro instanceof ErroApi && erro.status === 409) texto = 'Outra pessoa acabou de decidir este caso.';
      else if (erro instanceof ErroApi && erro.status === 404) texto = 'Este caso já não está na fila da regulação.';
      else if (erro instanceof ErroApi) texto = erro.message;
      setEstado({ tipo: 'editando', erro: texto });
    }
  }

  if (estado.tipo === 'feita') {
    return (
      <section className="painel" aria-labelledby="titulo-decisao">
        <h2 id="titulo-decisao">Decisão</h2>
        <div className="aviso-ok" role="status">
          <strong>Caso decidido: {nomeDoEstado(estado.stCaso)}.</strong>
          O motivo ficou no histórico, com o seu nome. O caso saiu da fila.
        </div>
        <Link to="/fila" className="botao-secundario">Voltar à fila</Link>
      </section>
    );
  }

  return (
    <section className="painel" aria-labelledby="titulo-decisao">
      <h2 id="titulo-decisao">Decisão</h2>
      <p className="painel-vazio">
        &ldquo;Resolvido&rdquo; ainda não está disponível: depende da comparação de candidatos e da dupla
        conferência. Por enquanto, a central pode encerrar sem identificação ou encaminhar à perícia.
      </p>
      <form className="decisao" onSubmit={(e) => void registrar(e)}>
        <fieldset>
          <legend>Como o caso sai da fila</legend>
          {DECISOES.map((d) => (
            <label key={d.valor} className="decisao-opcao">
              <input
                type="radio" name="decisao" value={d.valor}
                checked={decisao === d.valor}
                onChange={() => setDecisao(d.valor)}
              />
              <span>
                <strong>{d.rotulo}</strong>
                <small>{d.ajuda}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {/* O rotulo tem so "Motivo": a ajuda fica fora dele, ligada por
            aria-describedby, senao o leitor de tela le tudo como o nome. */}
        <div className="campo">
          <label htmlFor="motivo-decisao"><span>Motivo</span></label>
          <textarea
            id="motivo-decisao"
            value={motivo}
            maxLength={MOTIVO_MAXIMO}
            rows={3}
            onChange={(e) => setMotivo(e.target.value)}
            aria-describedby="ajuda-motivo"
          />
          <small id="ajuda-motivo">
            Vai para o histórico do caso, com o seu nome. Mínimo de {MOTIVO_MINIMO} caracteres ({tamanho}/{MOTIVO_MAXIMO}).
          </small>
        </div>
        {estado.tipo === 'editando' && estado.erro && (
          <div className="aviso" role="alert"><strong>{estado.erro}</strong></div>
        )}
        <button type="submit" className="botao" disabled={!pronto || estado.tipo === 'enviando'}>
          {estado.tipo === 'enviando' ? 'Registrando…' : 'Registrar decisão'}
        </button>
      </form>
    </section>
  );
}

type EstadoDasFotos =
  | { tipo: 'fechado' }
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; fotos: Foto[] }
  | { tipo: 'erro'; mensagem: string };

/**
 * Fotos de marca identificadora tiradas em campo.
 *
 * (!) SÓ CARREGAM QUANDO ALGUÉM PEDE. Abrir o caso não mostra as fotos: é o
 *     dado mais sensível do registro, e o servidor põe na trilha quem as viu.
 *     Carregar sozinho poria na trilha quem só abriu o caso para ler o local.
 *
 * (!) A URL DE CADA FOTO EXPIRA EM MINUTOS. Se a tela ficar aberta além disso,
 *     a imagem deixa de carregar; o botão pede URLs novas (e isso é outra
 *     consulta na trilha, como deve ser).
 */
function Fotos({ coCaso }: { coCaso: string }) {
  const [estado, setEstado] = useState<EstadoDasFotos>({ tipo: 'fechado' });
  const [expiradas, setExpiradas] = useState(false);

  async function mostrar(): Promise<void> {
    setEstado({ tipo: 'carregando' });
    setExpiradas(false);
    try {
      setEstado({ tipo: 'pronto', fotos: await buscarFotos(coCaso) });
    } catch (erro) {
      setEstado({
        tipo: 'erro',
        mensagem: erro instanceof ErroApi ? erro.message : 'Não foi possível carregar as fotos.',
      });
    }
  }

  return (
    <section className="painel" aria-labelledby="titulo-fotos">
      <h2 id="titulo-fotos">Fotos</h2>

      {estado.tipo === 'fechado' && (
        <>
          <p className="painel-vazio">
            As fotos só aparecem quando você pede, e quem as vê fica registrado na trilha.
          </p>
          <button type="button" className="botao-secundario" onClick={() => void mostrar()}>
            Mostrar fotos
          </button>
        </>
      )}

      {estado.tipo === 'carregando' && <p className="painel-vazio" role="status">Carregando as fotos…</p>}

      {estado.tipo === 'erro' && (
        <div className="aviso" role="alert">
          <strong>{estado.mensagem}</strong>
          <button type="button" className="botao-secundario" onClick={() => void mostrar()}>
            Tentar de novo
          </button>
        </div>
      )}

      {estado.tipo === 'pronto' && estado.fotos.length === 0 && (
        <p className="painel-vazio">A equipe não anexou fotos neste caso.</p>
      )}

      {estado.tipo === 'pronto' && estado.fotos.length > 0 && (
        <>
          {expiradas && (
            <div className="aviso" role="alert">
              <strong>O acesso às fotos expirou.</strong>
              <button type="button" className="botao-secundario" onClick={() => void mostrar()}>
                Carregar de novo
              </button>
            </div>
          )}
          <ul className="fotos">
            {estado.fotos.map((f) => (
              <li key={f.idMidia}>
                <a href={f.url} target="_blank" rel="noreferrer noopener">
                  <img
                    src={f.url}
                    alt={f.dsLegenda ?? `Foto ${f.idMidia} do caso ${coCaso}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() => setExpiradas(true)}
                  />
                </a>
                <span className="fotos-legenda">
                  {f.dsLegenda && <>{f.dsLegenda} · </>}
                  {f.noAutor} · <span className="mono">{formatarCarimbo(f.capturadaEm)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
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
