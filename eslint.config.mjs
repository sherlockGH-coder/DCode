import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Policy: enable only rules that catch real bugs; do not enforce style.
 *
 * Focus on two classes of issues that were previously unchecked:
 *   - react-hooks dependency arrays; this codebase has many hand-written useEffect calls.
 *   - floating Promises; the main process has many async IPC and tool calls, and a missing await silently hides errors.
 */
export default tseslint.config(
  {
    ignores: [
      'out/**',
      'release/**',
      'node_modules/**',
      'design-explorations/**',
      'prototypes/**',
      'settings-prototype/**',
      'test-results/**',
      'scripts/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js', '*.mjs'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // --- Things we actually want to catch ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],

      // The codebase intentionally uses `try { … } catch {}` to mean "ignore failures".
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Handling ANSI escape sequences necessarily matches control characters.
      'no-control-regex': 'off',

      // Produces too many false positives with callback-based Electron and Node APIs.
      '@typescript-eslint/unbound-method': 'off',

      // Matches are forwarding existing rejections (`.then(ok, err => reject(err))`)
      // or forwarding AbortSignal.reason, not constructing non-Error rejection values.
      '@typescript-eslint/prefer-promise-reject-errors': 'off',

      // Matches are defensive String() conversions of YAML frontmatter and JSON parse results.
      // The input is untrusted, so degrading to "[object Object]" is acceptable rather than a bug.
      '@typescript-eslint/no-base-to-string': 'off',

      // --- Disable rules that are too noisy and do not affect correctness ---
      // This codebase uses any and dynamic structures at IPC boundaries; fully converging them is a separate project.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // Unused variables: allow an underscore prefix as an explicit ignore marker.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
    },
  },

  // --- Renderer: add react-hooks rules ---
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Downgrade renderer violations to warn: `useEffect(() => { load(); }, [])` is common React usage,
      // and failures usually appear in the UI. Keep main-process violations as errors because swallowed errors have no other outlet.
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },

  // --- Main process / preload: Node globals ---
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // --- Relaxations for test files ---
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // --- Files outside every tsconfig: syntax-level checks only ---
  // resources/mcp contains ESM shims for the MCP runtime.
  {
    files: ['resources/**/*.mjs', 'resources/**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
