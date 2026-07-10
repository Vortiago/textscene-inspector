import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

/**
 * ESLint flat configuration (ESLint 9+)
 * Provides TypeScript linting for the entire monorepo.
 */
export default [
  // Global ignores - must be first
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/out/',
      '**/build/',
      '**/.vscode-test/',
      '**/.vscode-test-web/',
      '**/.test-workspace/',
      '**/.test-workspace-web/',
      '**/.claude/',
      '**/.tmp/',
      '.spike/',
      'docs/probes/',
    ],
  },

  // Base recommended config
  eslint.configs.recommended,

  // TypeScript files - Node.js environment (extension main code + linter CLI)
  {
    files: ['apps/textscene-vscode/src/**/*.ts', 'apps/textscene-linter/src/**/*.ts'],
    ignores: ['apps/textscene-vscode/src/webview/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.base.json',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // TypeScript files - Browser + Node.js environment (core package - runs in both)
  {
    files: ['packages/textscene-core/src/**/*.ts', 'packages/textscene-core/src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.base.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Guard: node-type parser/linter registration entry points must stay
  // React/THREE-free (ADR-0001). `index.ts` registers the parser, `index.linter.ts`
  // the lint rules — only `index.r3f.ts` may import the render component. The
  // runtime `linter/reactFree.test.ts` is the comprehensive module-graph check;
  // this is the fast editor-time guard against the obvious leak.
  {
    files: [
      'packages/textscene-core/src/nodes/**/index.ts',
      'packages/textscene-core/src/nodes/**/index.linter.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'three',
                'three/*',
                'react',
                'react-dom',
                '@react-three/*',
                '*.tsx',
                '**/*.tsx',
                '**/Component',
                '**/Component.js',
                '**/index.r3f',
                '**/index.r3f.js',
              ],
              message:
                'Parser/linter slice entry points must stay React/THREE-free (ADR-0001). Register the render component in index.r3f.ts instead.',
            },
          ],
        },
      ],
    },
  },

  // Config files and scripts - Node.js environment
  {
    files: ['**/*.config.js', '**/*.config.mjs', '**/scripts/**/*.js', '**/scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript files - Browser environment (web previewer, webview)
  {
    files: [
      'apps/textscene-web/src/**/*.ts',
      'apps/textscene-web/src/**/*.tsx',
      'apps/textscene-vscode/src/webview/**/*.ts',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.base.json',
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Test files
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx', '**/test-setup.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.base.json',
      },
      globals: {
        ...globals.node,
        ...globals.mocha,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' in test files for mocking
    },
  },
];
