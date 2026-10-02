import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moldura } from '@/componentes/Moldura';
import {
  ErroApi, FINALIDADES, alterarProfissional, buscarProfissionais, buscarReferencias, criarProfissional, nomeDaFinalidade,
} from '@/servicos/administracao';
import type { CodigoDaFinalidade, Profissional, Referencias } from '@/servicos/administracao';
import { esquecerSessao } from '@/servicos/sessao';

type Carga =
  | { tipo: 'carregando' }
  | { tipo: 'pronto'; lista: Profissional[]; referencias: Referencias }
  | { tipo: 'erro'; mensagem: string };

/** O valor do select validado contra a lista, sem assercao de tipo. */
function paraFinalidade(v: string): CodigoDaFinalidade {
  return FINALIDADES.find((f) => f.valor === v)?.valor ?? 'ASSISTENCIAL';
}

function textoDoErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroApi ? erro.message : padrao;
}

/**
 * Profissionais (US-34): quem tem acesso, com qual finalidade e perfis.
 *
 * (!) NINGUÉM DEFINE A SENHA DE OUTRA PESSOA. A conta nasce sem senha, e a
 *     coluna "Situação" diz se o primeiro acesso já foi feito. A tela explica
 *     onde a pessoa define a dela.
 *
 * (!) DESATIVAR, NUNCA APAGAR: a conta inativa perde o acesso na hora, e o que
 *     ela registrou continua com autor.
 */
export function Profissionais() {
  const navegar = useNavigate();
  const [carga, setCarga] = useState<Carga>({ tipo: 'carregando' });
  const [novo, setNovo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editando, setEditando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [lista, referencias] = await Promise.all([buscarProfissionais(), buscarReferencias()]);
      setCarga({ tipo: 'pronto', lista, referencias });
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) {
        esquecerSessao();
        navegar('/entrar', { replace: true, state: { de: '/admin/profissionais' } });
        return;
      }
      setCarga({ tipo: 'erro', mensagem: textoDoErro(erro, 'Não foi possível carregar os profissionais.') });
    }
  }, [navegar]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function alternarAtivo(p: Profissional): Promise<void> {
    setAviso(null);
    try {
      await alterarProfissional(p.id, { ativo: !p.ativo });
      setAviso(p.ativo ? `${p.nome} foi desativado(a) e perdeu o acesso.` : `${p.nome} foi reativado(a).`);
      await carregar();
    } catch (erro) {
      setAviso(textoDoErro(erro, 'Não foi possível alterar.'));
    }
  }

  return (
    <Moldura>
      <div className="titulo">
        <h1>Profissionais</h1>
        {carga.tipo === 'pronto' && <span className="titulo-contagem">{carga.lista.length}</span>}
        {!novo && (
          <button type="button" className="botao-secundario titulo-acao" onClick={() => { setNovo(true); setAviso(null); }}>
            Cadastrar profissional
          </button>
        )}
      </div>
      <p className="subtitulo">
        Cada conta é individual. A conta nasce sem senha: a pessoa define a dela em
        &ldquo;Primeiro acesso&rdquo; (console) ou &ldquo;Perdi minha senha&rdquo; (aplicativo), com o e-mail cadastrado.
      </p>

      {aviso && <div className="aviso-ok" role="status"><strong>{aviso}</strong></div>}

      {novo && carga.tipo === 'pronto' && (
        <FormularioNovo
          referencias={carga.referencias}
          aoCancelar={() => setNovo(false)}
          aoCriar={async (nome) => {
            setNovo(false);
            setAviso(`Conta de ${nome} criada, sem senha. Peça para a pessoa fazer o primeiro acesso com o e-mail cadastrado.`);
            await carregar();
          }}
        />
      )}

      {carga.tipo === 'carregando' && <div className="vazio" role="status">Carregando…</div>}
      {carga.tipo === 'erro' && <div className="aviso" role="alert"><strong>{carga.mensagem}</strong></div>}

      {carga.tipo === 'pronto' && (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th><th>E-mail</th><th>CPF</th><th>Finalidade</th><th>Perfis</th><th>Situação</th><th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {carga.lista.map((p) => (
              <tr key={p.id} className={p.ativo ? undefined : 'linha-inativa'}>
                <td>{p.nome}{p.cargo && <small className="celula-nota">{p.cargo}</small>}</td>
                <td>{p.email ?? '—'}</td>
                <td className="mono">{p.cpf}</td>
                <td>
                  {editando === p.id ? (
                    <EditorDeAcesso
                      profissional={p}
                      referencias={carga.referencias}
                      aoFechar={() => setEditando(null)}
                      aoSalvar={async () => {
                        setEditando(null);
                        setAviso(`Acesso de ${p.nome} alterado.`);
                        await carregar();
                      }}
                    />
                  ) : nomeDaFinalidade(p.finalidade)}
                </td>
                <td>{p.perfis.length > 0 ? p.perfis.join(', ') : '—'}</td>
                <td>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                  {p.ativo && !p.temSenha && <small className="celula-nota">aguardando primeiro acesso</small>}
                </td>
                <td className="celula-acoes">
                  {editando !== p.id && (
                    <button type="button" className="botao-secundario" onClick={() => setEditando(p.id)}>
                      Alterar acesso
                    </button>
                  )}
                  <button type="button" className="botao-secundario" onClick={() => void alternarAtivo(p)}>
                    {p.ativo ? 'Desativar' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Moldura>
  );
}

function CaixasDePerfil({ referencias, marcados, aoMudar }: {
  referencias: Referencias; marcados: string[]; aoMudar: (perfis: string[]) => void;
}) {
  return (
    <fieldset className="caixas">
      <legend>Perfis</legend>
      {referencias.perfis.map((perfil) => (
        <label key={perfil.codigo}>
          <input
            type="checkbox"
            checked={marcados.includes(perfil.codigo)}
            onChange={(e) => aoMudar(e.target.checked
              ? [...marcados, perfil.codigo]
              : marcados.filter((c) => c !== perfil.codigo))}
          />
          {perfil.nome}
        </label>
      ))}
    </fieldset>
  );
}

function FormularioNovo({ referencias, aoCancelar, aoCriar }: {
  referencias: Referencias; aoCancelar: () => void; aoCriar: (nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [conselho, setConselho] = useState('');
  const [finalidade, setFinalidade] = useState<CodigoDaFinalidade>('ASSISTENCIAL');
  const [perfis, setPerfis] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await criarProfissional({ nome: nome.trim(), cpf, email: email.trim(), cargo, conselho, finalidade, perfis });
      await aoCriar(nome.trim());
    } catch (erro) {
      setErro(erro instanceof ErroApi && erro.status === 400 && !erro.campo
        ? 'Confira os campos: nome com pelo menos 3 letras, CPF válido e e-mail.'
        : textoDoErro(erro, 'Não foi possível cadastrar.'));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="painel formulario" onSubmit={(e) => void enviar(e)} aria-label="Cadastrar profissional">
      <h2>Cadastrar profissional</h2>
      <div className="formulario-grade">
        <label className="campo"><span>Nome completo</span>
          <input required minLength={3} maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="campo"><span>CPF</span>
          <input required inputMode="numeric" className="mono" maxLength={14} value={cpf} onChange={(e) => setCpf(e.target.value)} />
        </label>
        <label className="campo"><span>E-mail</span>
          <input type="email" required maxLength={180} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo"><span>Cargo (opcional)</span>
          <input maxLength={60} value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </label>
        <label className="campo"><span>Conselho (opcional)</span>
          <input maxLength={30} value={conselho} onChange={(e) => setConselho(e.target.value)} placeholder="ex.: COREN-BA 123456" />
        </label>
        <label className="campo"><span>Finalidade</span>
          <select value={finalidade} onChange={(e) => setFinalidade(paraFinalidade(e.target.value))}>
            {FINALIDADES.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </select>
        </label>
      </div>
      <CaixasDePerfil referencias={referencias} marcados={perfis} aoMudar={setPerfis} />
      {erro && <div className="aviso" role="alert"><strong>{erro}</strong></div>}
      <div className="formulario-acoes">
        <button type="submit" className="botao" disabled={ocupado}>{ocupado ? 'Cadastrando…' : 'Cadastrar'}</button>
        <button type="button" className="botao-secundario" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function EditorDeAcesso({ profissional, referencias, aoFechar, aoSalvar }: {
  profissional: Profissional; referencias: Referencias; aoFechar: () => void; aoSalvar: () => Promise<void>;
}) {
  const [finalidade, setFinalidade] = useState<CodigoDaFinalidade>(
    FINALIDADES.find((f) => f.valor === profissional.finalidade)?.valor ?? 'ASSISTENCIAL',
  );
  const [perfis, setPerfis] = useState<string[]>(profissional.perfis);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(): Promise<void> {
    setErro(null);
    try {
      await alterarProfissional(profissional.id, { finalidade, perfis });
      await aoSalvar();
    } catch (e) {
      setErro(textoDoErro(e, 'Não foi possível alterar.'));
    }
  }

  return (
    <div className="editor-acesso">
      <label className="campo"><span>Finalidade</span>
        <select value={finalidade} onChange={(e) => setFinalidade(paraFinalidade(e.target.value))}>
          {FINALIDADES.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
        </select>
      </label>
      <CaixasDePerfil referencias={referencias} marcados={perfis} aoMudar={setPerfis} />
      {erro && <div className="aviso" role="alert"><strong>{erro}</strong></div>}
      <div className="formulario-acoes">
        <button type="button" className="botao" onClick={() => void salvar()}>Salvar</button>
        <button type="button" className="botao-secundario" onClick={aoFechar}>Cancelar</button>
      </div>
    </div>
  );
}
