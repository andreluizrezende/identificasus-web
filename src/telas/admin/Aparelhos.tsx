import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moldura } from '@/componentes/Moldura';
import { formatarCarimbo } from '@/dominio/datas';
import {
  ErroApi, buscarAparelhos, buscarReferencias, cadastrarAparelho, revogarAparelho,
} from '@/servicos/administracao';
import type { Aparelho, Referencias } from '@/servicos/administracao';
import { esquecerSessao, obterSessao } from '@/servicos/sessao';

type Carga =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; lista: Aparelho[]; referencias: Referencias }
  | { tipo: 'erro'; mensagem: string };

const MOTIVO_MINIMO = 10;

/**
 * Aparelhos e estações (US-34): o que pode entrar no sistema. O código é o da
 * etiqueta, e é o que se digita no login; aparelho fora desta lista não entra.
 *
 * (!) REVOGAR NÃO TEM VOLTA PELA TELA. É a resposta a tablet perdido ou
 *     roubado, e pede motivo. Reativar é decisão à parte, no banco.
 *
 * (!) A PRÓPRIA ESTAÇÃO É AVISADA. Revogar a estação em uso tranca o próximo
 *     login de quem está nela; a tela diz isso antes de confirmar.
 */
export function Aparelhos() {
  const navegar = useNavigate();
  const [carga, setCarga] = useState<Carga>({ tipo: 'carregando' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<string | null>(null);
  const estacaoAtual = obterSessao()?.coDispositivo ?? null;

  const carregar = useCallback(async () => {
    try {
      const [lista, referencias] = await Promise.all([buscarAparelhos(), buscarReferencias()]);
      setCarga({ tipo: 'pronto', lista, referencias });
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        esquecerSessao();
        navegar('/entrar', { replace: true, state: { de: '/admin/aparelhos' } });
        return;
      }
      setCarga({ tipo: 'erro', mensagem: erro instanceof ErroApi ? erro.message : 'Não foi possível carregar os aparelhos.' });
    }
  }, [navegar]);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <Moldura>
      <div className="titulo">
        <h1>Aparelhos e estações</h1>
        {carga.tipo === 'pronto' && <span className="titulo-contagem">{carga.lista.length}</span>}
      </div>
      <p className="subtitulo">
        Tablets de campo e computadores da central. O código é o da etiqueta e é o que se digita para entrar.
      </p>

      {aviso && <div className="aviso-ok" role="status"><strong>{aviso}</strong></div>}

      {carga.tipo === 'pronto' && (
        <FormularioAparelho
          referencias={carga.referencias}
          aoCadastrar={async (codigo) => {
            setAviso(`Aparelho ${codigo} autorizado.`);
            await carregar();
          }}
        />
      )}

      {carga.tipo === 'carregando' && <div className="vazio" role="status">Carregando…</div>}
      {carga.tipo === 'erro' && <div className="aviso" role="alert"><strong>{carga.mensagem}</strong></div>}

      {carga.tipo === 'pronto' && (
        <table className="tabela">
          <thead>
            <tr><th>Código</th><th>Base</th><th>Modelo</th><th>Situação</th><th>Ações</th></tr>
          </thead>
          <tbody>
            {carga.lista.map((a) => (
              <tr key={a.codigo} className={a.ativo ? undefined : 'linha-inativa'}>
                <td className="mono">{a.codigo}{a.codigo === estacaoAtual && <small className="celula-nota">esta estação</small>}</td>
                <td>{a.nomeBase} <small className="mono">{a.base}</small></td>
                <td>{a.modelo ?? '—'}</td>
                <td>{a.revogadoEm ? `Revogado em ${formatarCarimbo(a.revogadoEm)}` : a.ativo ? 'Autorizado' : 'Inativo'}</td>
                <td className="celula-acoes">
                  {!a.revogadoEm && revogando !== a.codigo && (
                    <button type="button" className="botao-secundario" onClick={() => { setRevogando(a.codigo); setAviso(null); }}>
                      Revogar
                    </button>
                  )}
                  {revogando === a.codigo && (
                    <ConfirmarRevogacao
                      aparelho={a}
                      estacaoAtual={a.codigo === estacaoAtual}
                      aoFechar={() => setRevogando(null)}
                      aoRevogar={async () => {
                        setRevogando(null);
                        setAviso(`Aparelho ${a.codigo} revogado. Ele não entra mais no sistema.`);
                        await carregar();
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Moldura>
  );
}

function FormularioAparelho({ referencias, aoCadastrar }: {
  referencias: Referencias; aoCadastrar: (codigo: string) => Promise<void>;
}) {
  const bases = referencias.bases.filter((b) => b.ativa);
  const [codigo, setCodigo] = useState('');
  const [base, setBase] = useState(bases[0]?.codigo ?? '');
  const [modelo, setModelo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const c = codigo.trim().toUpperCase();
      await cadastrarAparelho({ codigo: c, base, modelo: modelo.trim() });
      setCodigo('');
      setModelo('');
      await aoCadastrar(c);
    } catch (erro) {
      setErro(erro instanceof ErroApi && erro.status === 400 && !erro.campo
        ? 'Código só com letras, números e "-" (o trecho "-HOM-" é reservado à homologação).'
        : erro instanceof ErroApi ? erro.message : 'Não foi possível cadastrar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="painel formulario" onSubmit={(e) => void enviar(e)} aria-label="Autorizar aparelho">
      <h2>Autorizar aparelho ou estação</h2>
      <div className="formulario-grade">
        <label className="campo"><span>Código da etiqueta</span>
          <input
            required maxLength={30} className="mono" value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="ex.: TAB-0001"
          />
        </label>
        <label className="campo"><span>Base</span>
          <select required value={base} onChange={(e) => setBase(e.target.value)}>
            {bases.map((b) => <option key={b.codigo} value={b.codigo}>{b.nome} ({b.codigo})</option>)}
          </select>
        </label>
        <label className="campo"><span>Modelo (opcional)</span>
          <input maxLength={80} value={modelo} onChange={(e) => setModelo(e.target.value)} />
        </label>
      </div>
      {erro && <div className="aviso" role="alert"><strong>{erro}</strong></div>}
      <div className="formulario-acoes">
        <button type="submit" className="botao" disabled={ocupado || base === ''}>{ocupado ? 'Autorizando…' : 'Autorizar'}</button>
      </div>
    </form>
  );
}

function ConfirmarRevogacao({ aparelho, estacaoAtual, aoFechar, aoRevogar }: {
  aparelho: Aparelho; estacaoAtual: boolean; aoFechar: () => void; aoRevogar: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const pronto = motivo.trim().length >= MOTIVO_MINIMO;

  async function confirmar(): Promise<void> {
    setErro(null);
    try {
      await revogarAparelho(aparelho.codigo, motivo.trim());
      await aoRevogar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível revogar.');
    }
  }

  return (
    <div className="editor-acesso" role="group" aria-label={`Revogar ${aparelho.codigo}`}>
      <strong>Revogar {aparelho.codigo} não tem volta pela tela.</strong>
      {estacaoAtual && <span className="aviso-texto">É esta estação: o próximo login nela não vai entrar.</span>}
      <div className="campo">
        <label htmlFor={`motivo-${aparelho.codigo}`}><span>Motivo</span></label>
        <input
          id={`motivo-${aparelho.codigo}`} maxLength={200} value={motivo}
          onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: tablet roubado na base"
        />
      </div>
      {erro && <div className="aviso" role="alert"><strong>{erro}</strong></div>}
      <div className="formulario-acoes">
        <button type="button" className="botao" disabled={!pronto} onClick={() => void confirmar()}>Revogar</button>
        <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
      </div>
    </div>
  );
}
