import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DIGITOS_DO_CODIGO, SENHA_MINIMA, definirSenha, pedirCodigo } from '@/servicos/recuperacao';

/**
 * Primeiro acesso ou senha esquecida, em duas etapas: pedir o código (vai
 * para o e-mail) e definir a senha com ele.
 *
 * (!) A RESPOSTA DO PEDIDO É A MESMA para e-mail cadastrado ou não: a tela
 *     repete o que o servidor diz e sempre segue para a etapa do código.
 *     Dizer "este e-mail não existe" entregaria a lista de contas a quem
 *     tentasse.
 */
export function RecuperarSenha() {
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [pedido, setPedido] = useState<{ mensagem: string; acao: string } | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; acao: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function pedir(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const r = await pedirCodigo(email.trim());
      if (r.ok) setPedido({ mensagem: r.mensagem, acao: r.acao });
      else setErro({ mensagem: r.mensagem, acao: r.acao });
    } finally {
      setOcupado(false);
    }
  }

  async function definir(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) {
      setErro({ mensagem: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`, acao: 'Use uma frase que você lembre.' });
      return;
    }
    if (senha.trim().toLowerCase() === email.trim().toLowerCase()) {
      setErro({ mensagem: 'A senha não pode ser o próprio e-mail.', acao: 'Escolha outra senha.' });
      return;
    }
    setOcupado(true);
    try {
      const r = await definirSenha({ dsEmail: email.trim(), coCodigo: codigo.trim(), novaSenha: senha });
      if (r.ok) {
        navegar('/entrar', { replace: true, state: { aviso: 'Senha definida. Entre com ela.' } });
        return;
      }
      setErro({ mensagem: r.mensagem, acao: r.acao });
    } finally {
      // A senha sai da memória do componente assim que deixa de ser necessária.
      setSenha('');
      setOcupado(false);
    }
  }

  return (
    <div className="entrar">
      <form className="entrar-cartao" onSubmit={(e) => void (pedido ? definir(e) : pedir(e))}>
        <img className="entrar-logo" src="/logo-samu.svg" alt="SAMU 192" />
        <h1>Primeiro acesso ou senha esquecida</h1>
        <p>
          Conta nova chega sem senha: você define a sua aqui, com um código de {DIGITOS_DO_CODIGO} dígitos
          enviado ao seu e-mail.
        </p>

        <label className="campo">
          <span>E-mail</span>
          <input
            type="email" required autoComplete="username" readOnly={pedido !== null}
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {pedido && (
          <>
            <div className="aviso-ok" role="status">
              <strong>{pedido.mensagem}</strong>
              {pedido.acao}
            </div>
            <label className="campo">
              <span>Código recebido</span>
              <input
                required inputMode="numeric" autoComplete="one-time-code" className="mono"
                maxLength={DIGITOS_DO_CODIGO}
                value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </label>
            <div className="campo">
              <label htmlFor="senha-nova"><span>Senha nova</span></label>
              <input
                id="senha-nova" type="password" required autoComplete="new-password" aria-describedby="senha-ajuda"
                value={senha} onChange={(e) => setSenha(e.target.value)}
              />
              <small id="senha-ajuda">Pelo menos {SENHA_MINIMA} caracteres, diferente do e-mail.</small>
            </div>
          </>
        )}

        {erro && (
          <div className="alerta" role="alert">
            <strong>{erro.mensagem}</strong>
            <span>{erro.acao}</span>
          </div>
        )}

        <button type="submit" className="botao" disabled={ocupado}>
          {ocupado ? 'Enviando…' : pedido ? 'Definir senha' : 'Enviar código'}
        </button>
        <p className="entrar-nota"><Link to="/entrar">Voltar para entrar</Link></p>
      </form>
    </div>
  );
}
