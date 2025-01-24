import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // File patterns
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
  },

  // Global variables
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // TypeScript ESLint recommended configs
  ...tseslint.configs.recommended,

  // Custom rules (from .eslintrc.json)
  {
    rules: {
      'no-console': 'warn',
      semi: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
