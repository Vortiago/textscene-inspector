import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
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
      // Vendored third-party source (minified); linted upstream, not here.
      'scripts/compare-docs/vendor/',
      // Generated MSDF font atlas: the base64 PNG and per-glyph
      // JSON table are hundreds of KB on single lines. Produced by
      // `scripts/fonts/bake-metrics.mjs`; drift is caught by its `--check`
      // mode, not by lint.
      'packages/textscene-core/src/r3f/controls/native/text/openSansAtlas.ts',
    ],
  },

  // Base recommended config
  eslint.configs.recommended,

  // TypeScript files - Node.js environment (extension main code, linter CLI, TS config files)
  {
    files: [
      'apps/textscene-vscode/src/**/*.ts',
      'apps/textscene-linter/src/**/*.ts',
      'packages/textscene-dev-kit/src/**/*.ts',
      '**/*.config.ts',
      'vitest.shared.ts',
    ],
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
    files: ['packages/textscene-core/src/**/*.{ts,tsx}'],
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
      'react-hooks': reactHooks,
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
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // A node type's parser and linter entry points stay React- and THREE-free (ADR-0001): only
  // `index.r3f.ts` imports the render component. This is the fast editor-time guard against the
  // obvious leak. `linter/reactFree.test.ts` checks the whole module graph.
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
    files: [
      '**/*.config.js',
      '**/*.config.mjs',
      '**/scripts/**/*.js',
      '**/scripts/**/*.mjs',
      'githooks/*.mjs',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript files - Browser environment (web previewer, webview)
  {
    files: [
      'apps/textscene-web/src/**/*.{ts,tsx}',
      'apps/textscene-vscode/src/webview/**/*.{ts,tsx}',
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
      'react-hooks': reactHooks,
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
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  // Test files
  {
    // `*.testkit.ts` is the repo's spelling for a test-only helper module that
    // is not itself a suite; vitest excludes it from coverage the same way.
    files: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.test.tsx',
      '**/*.spec.tsx',
      '**/*.testkit.ts',
      '**/*.testkit.tsx',
      '**/test-setup.ts',
    ],
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
