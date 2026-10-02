/**
 * Fronteiras verificadas em CI, como no identificasus-app.
 */
module.exports = {
  forbidden: [
    {
      name: 'sem-ciclos',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-orfaos',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$'] },
      to: {},
    },
    {
      // Telas nao falam com a rede direto: passam por servicos/, onde a
      // resposta e validada com Zod antes de virar dado da tela.
      name: 'telas-sem-fetch-direto',
      severity: 'error',
      from: { path: '^src/telas' },
      to: { path: '^src/servicos/api\\.ts$' },
    },
    {
      name: 'dominio-e-folha',
      comment: 'O dominio nao depende de tela, servico ou componente',
      severity: 'error',
      from: { path: '^src/dominio' },
      to: { path: '^src/(telas|servicos|componentes)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
