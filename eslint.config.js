import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '*.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript apaga tipos em tempo de execucao: um `any` vindo da rede
      // corrompe o dominio em silencio. Toda fronteira valida com Zod.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Adaptadores podem asserir tipo logo apos a validacao Zod.
    files: ['src/servicos/**'],
    rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
  },
  {
    // Testes montam dubles de fetch e de modulos.
    files: ['**/*.test.{ts,tsx}', 'e2e/**'],
    rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
  },
);
