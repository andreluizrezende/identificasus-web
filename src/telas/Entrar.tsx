import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { entrar } from '@/servicos/sessao';

/**
 * `location.state` vem do histórico do navegador e pode ser forjado. Só
 * caminho interno passa: um "de" com "//" ou esquema seria redirecionamento
 * aberto. Mesma regra da tela de entrar do app de campo.
 */
function rotaDeOrigem(estado: unknown): string {
  if (typeof estado !== 'object' || estado === null || !('de' in estado)) return '/fila';
  const de: unknown = Reflect.get(estado, 'de');
  return typeof de === 'string' && de.startsWith('/') && !de.startsWith('//') && de !== '/entrar'
    ? de
    : '/fila';
}

export function Entrar() {
  const navegar = useNavigate();
  const local = useLocation();
  const [dsEmail, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [coDispositivo, setDispositivo] = useState('');
  const [erro, setErro] = useState<{ mensagem: string; acao: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await entrar({ dsEmail: dsEmail.trim(), senha, coDispositivo: coDispositivo.trim() });
      if (!r.ok) {
        setErro({ mensagem: r.mensagem, acao: r.acao });
        return;
      }
      navegar(rotaDeOrigem(local.state), { replace: true });
    } finally {
      // A senha sai da memória do componente assim que deixa de ser necessária.
      setSenha('');
      setOcupado(false);
    }
  }

  return (
    <div className="entrar">
      <form className="entrar-cartao" onSubmit={(e) => void enviar(e)}>
        <h1>Central de Regulação</h1>
        <p>IdentificaSUS · SAMU 192 Salvador. Acesso individual: toda decisão de vínculo tem autor.</p>

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email" required autoComplete="username"
            value={dsEmail} onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input
            type="password" required autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        {/* A ajuda fica fora do <label>: dentro, ela viraria parte do nome do
            campo e o leitor de tela leria a frase inteira como rótulo. */}
        <div className="campo">
          <label htmlFor="estacao"><span>Código da estação</span></label>
          <input
            id="estacao" required autoComplete="off" className="mono" aria-describedby="estacao-ajuda"
            value={coDispositivo} onChange={(e) => setDispositivo(e.target.value.toUpperCase())}
          />
          <small id="estacao-ajuda">Está na etiqueta do computador. Estação fora do cadastro da central não entra.</small>
        </div>

        {erro && (
          <div className="alerta" role="alert">
            <strong>{erro.mensagem}</strong>
            <span>{erro.acao}</span>
          </div>
        )}

        <button type="submit" className="botao" disabled={ocupado}>
          {ocupado ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
