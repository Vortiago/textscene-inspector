import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** The imports that pull React or THREE into a module, for a file that must stay free of both. */
const REACT_AND_THREE_IMPORTS = [
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
];

/**
 * Core feeds browser bundles (the web previewer, the webview, the vscode.dev extension), so only
 * `resources/diskProject.ts` may read the disk.
 */
const NODE_ONLY_MESSAGE =
  'Core ships to the browser: only resources/diskProject.ts may use Node built-ins, and only the tscn-lint CLI and the tscn-lsp server may import it.';
const NODE_BUILTIN_PATHS = ['fs', 'fs/promises', 'path', 'os', 'url', 'child_process'].map((name) => ({
  name,
  message: NODE_ONLY_MESSAGE,
}));
const NODE_ONLY_PATTERNS = [
  { group: ['node:*', '**/diskProject', '**/diskProject.js'], message: NODE_ONLY_MESSAGE },
];

/** One `no-restricted-imports` setting: a later block's setting replaces an earlier one, so each block lists every group it needs. */
function restrictedImports(patterns, paths = []) {
  return ['error', { paths, patterns }];
}

/**
 * `registerAll` takes a validator table's parts as separate arguments and throws on a key two of
 * them share. A spread merges the parts first, last-wins, so the earlier validator is gone before
 * the check runs.
 */
const REGISTER_ALL_SPREAD = {
  selector: [
    "CallExpression[callee.property.name='registerAll'] SpreadElement",
    "CallExpression[callee.name='registerAll'] SpreadElement",
  ].join(', '),
  message:
    'Pass each part of a validator table to registerAll as its own argument. A spread keeps the last validator for a shared key and drops the earlier one without a report.',
};

/** A rule diagnostic with no `grounding` is a hand-written one that `armEmits` cannot see. */
const UNGROUNDED_RULE_DIAGNOSTIC = {
  selector:
    "ObjectExpression:has(> Property[key.name='ruleName']):not(:has(> Property[key.name='grounding']))",
  message:
    'Report a rule diagnostic through a declared arm: reportArm or armDiagnostic with a RuleArms entry, and emits: armEmits(arms).',
};

/**
 * A lint rule reads a node's values from `rawProperties`, the literals both parsers publish. The lenient
 * tree's `properties` holds typed render values, so a helper the render path shares would read other values.
 * A call's result is exempt: `lines.get(owner)?.properties` is a section's property lines, not a node's bag.
 */
const NODE_PROPERTIES_READ = {
  selector: "MemberExpression[property.name='properties'][object.type!='CallExpression']",
  message:
    "Read a node's values from rawProperties in a lint rule. properties holds typed render values on the lenient tree.",
};

/**
 * A core test asserts a tier through `toBeAtTier`, `toBeAllAtTier` or a helper that records it.
 * `expect(d.severity)` records nothing, so the setup file's title check cannot see the test.
 */
const RAW_SEVERITY_ASSERTION = {
  selector: [
    "CallExpression[callee.name='expect'] > MemberExpression.arguments[property.name='severity']",
    "CallExpression[callee.name='expect'] > ChainExpression.arguments > MemberExpression[property.name='severity']",
  ].join(', '),
  message:
    "Assert a tier with expect(diagnostic).toBeAtTier(tier). A raw severity read records no tier, so the test title's tier goes unchecked.",
};

/**
 * The ESLint configuration for the monorepo. The TypeScript parser runs without type information:
 * no rule here reads types, and a type-aware parse costs a whole TypeScript program per run.
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
      // Vendored third-party source (minified); linted upstream, not here.
      'scripts/compare-docs/vendor/',
      // Generated MSDF font atlas: the base64 PNG and per-glyph
      // JSON table are hundreds of KB on single lines. Produced by
      // `scripts/fonts/bake-metrics.mjs`; drift is caught by its `--check`
      // mode, not by lint.
      'packages/textscene-core/src/r3f/controls/native/text/openSansAtlas.ts',
    ],
  },

  eslint.configs.recommended,

  // TypeScript checks every identifier, so `no-undef` only adds false reports on its global types,
  // such as `Transferable`. typescript-eslint advises turning it off for TypeScript files.
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-undef': 'off',
    },
  },

  // TypeScript files - Node.js environment (extension main code, linter CLI, TS config files)
  {
    files: [
      'apps/textscene-vscode/src/**/*.ts',
      'apps/textscene-linter/src/**/*.ts',
      'apps/textscene-lsp/src/**/*.ts',
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

  // Core's production code reads no disk outside `resources/diskProject.ts`. The two blocks below
  // replace this setting for their files, so they repeat the Node groups.
  {
    files: ['packages/textscene-core/src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.testkit.ts',
      '**/*.testkit.tsx',
      'packages/textscene-core/src/**/testing/**',
      'packages/textscene-core/src/resources/diskProject.ts',
    ],
    rules: {
      'no-restricted-imports': restrictedImports(NODE_ONLY_PATTERNS, NODE_BUILTIN_PATHS),
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
      'no-restricted-imports': restrictedImports(
        [
          {
            group: REACT_AND_THREE_IMPORTS,
            message:
              'Parser/linter slice entry points must stay React/THREE-free (ADR-0001). Register the render component in index.r3f.ts instead.',
          },
          ...NODE_ONLY_PATTERNS,
        ],
        NODE_BUILTIN_PATHS
      ),
    },
  },

  // The language-feature engine runs in the VS Code extension host and the `tscn-lsp`
  // server, both plain Node bundles, so it stays React- and THREE-free.
  // `languageFeatures/reactFree.test.ts` checks the whole module graph.
  {
    files: ['packages/textscene-core/src/languageFeatures/**/*.ts'],
    ignores: ['**/*.test.ts', '**/*.testkit.ts'],
    rules: {
      'no-restricted-imports': restrictedImports(
        [
          {
            group: REACT_AND_THREE_IMPORTS,
            message:
              'The language-feature engine must stay React/THREE-free, so the extension host and the tscn-lsp server can import it.',
          },
          ...NODE_ONLY_PATTERNS,
        ],
        NODE_BUILTIN_PATHS
      ),
    },
  },

  // Test files are exempt: a registry test spreads a shared group on purpose.
  {
    files: ['packages/textscene-core/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': ['error', REGISTER_ALL_SPREAD],
    },
  },

  // The ESLint rule-arm guard. A rule reports only through a declared arm (`linter/ruleArms.ts`),
  // and `armEmits` derives the rule's `emits` from its arms. An object with a `ruleName` and no
  // `grounding` is a hand-written diagnostic that `emits` cannot see. `Linter.ts` takes a parse error's tier from the error, `ruleArms.ts` is
  // the arm API, and `testing/` builds expectations, so none of them is a rule.
  {
    files: ['packages/textscene-core/src/{nodes,linter}/**/*.ts'],
    ignores: [
      '**/*.test.ts',
      'packages/textscene-core/src/linter/testing/**',
      'packages/textscene-core/src/linter/Linter.ts',
      'packages/textscene-core/src/linter/ruleArms.ts',
    ],
    rules: {
      // Repeats REGISTER_ALL_SPREAD: for these files, this block's options replace the block above's.
      'no-restricted-syntax': ['error', REGISTER_ALL_SPREAD, UNGROUNDED_RULE_DIAGNOSTIC],
    },
  },

  // The rule files and the helpers only they import, under the arm guard above too.
  {
    files: [
      'packages/textscene-core/src/linter/**/*.ts',
      'packages/textscene-core/src/nodes/**/*{linter,Linter}*.ts',
      'packages/textscene-core/src/nodes/canvasitem/shared/clipAncestry.ts',
    ],
    ignores: [
      '**/*.test.ts',
      'packages/textscene-core/src/linter/testing/**',
      'packages/textscene-core/src/linter/Linter.ts',
      'packages/textscene-core/src/linter/ruleArms.ts',
    ],
    rules: {
      // Repeats both selectors above: for these files, this block's options replace theirs.
      'no-restricted-syntax': [
        'error',
        REGISTER_ALL_SPREAD,
        UNGROUNDED_RULE_DIAGNOSTIC,
        NODE_PROPERTIES_READ,
      ],
    },
  },

  // The extension and the web previewer read a project through `vscode.workspace.fs` or fetch,
  // never through Node's disk provider, which a vscode.dev or browser bundle cannot load.
  {
    files: ['apps/textscene-vscode/src/**/*.{ts,tsx}', 'apps/textscene-web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedImports([
        { group: ['@textscene/core/resources/diskProject'], message: NODE_ONLY_MESSAGE },
      ]),
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
    files: ['apps/textscene-web/src/**/*.{ts,tsx}', 'apps/textscene-vscode/src/webview/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
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

  {
    files: ['packages/textscene-core/src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', RAW_SEVERITY_ASSERTION],
    },
  },

  // An ambient `.d.ts` names types a syntax-only rule cannot resolve, so `no-undef`
  // reports each one.
  {
    files: ['**/*.d.ts'],
    rules: {
      'no-undef': 'off',
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
