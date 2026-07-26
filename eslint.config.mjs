import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * 规则取向：只开「能抓到真 bug」的那部分，不做风格约束。
 *
 * 重点是两类之前完全没人检查的问题：
 *   - react-hooks 的依赖数组（这个代码库手写 useEffect 很多）
 *   - 浮空的 Promise（主进程大量 async IPC / 工具调用，漏掉 await 会静默吞掉错误）
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
      'benchmark/**',
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
      // --- 真正想拦的东西 ---
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],

      // 代码库大量使用 `try { … } catch {}` 表示「失败就忽略」，这是有意为之
      'no-empty': ['error', { allowEmptyCatch: true }],

      // 处理 ANSI 转义序列必然要匹配控制字符
      'no-control-regex': 'off',

      // 与 Electron / node 的回调式 API 配合时误报多，价值低
      '@typescript-eslint/unbound-method': 'off',

      // 命中的都是转发已有 rejection（`.then(ok, err => reject(err))`）和
      // 转发 AbortSignal.reason，不是构造非 Error 的拒绝值
      '@typescript-eslint/prefer-promise-reject-errors': 'off',

      // 命中的都是对 YAML frontmatter / JSON 解析结果的防御性 String() 强转，
      // 输入本就不可信，退化成 "[object Object]" 是可接受的降级而非 bug
      '@typescript-eslint/no-base-to-string': 'off',

      // --- 噪音太大、且不影响正确性的先关掉 ---
      // 这个代码库大量使用 any 与 IPC 边界上的动态结构，全量收敛属于独立工程
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

      // 未使用变量：允许下划线前缀显式忽略
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

  // --- 渲染进程：额外加 react-hooks ---
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 渲染层降级为 warn：`useEffect(() => { load(); }, [])` 是 React 的常规写法，
      // 且这里的失败通常会在界面上显现。主进程保持 error——那边吞掉的错误没有任何出口。
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },

  // --- 主进程 / preload：Node 全局 ---
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // --- 测试文件放宽 ---
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // --- 不在任何 tsconfig 里的文件：只做语法级检查 ---
  // e2e 由 playwright 直接运行，resources/mcp 下是 MCP 运行时的 ESM 垫片
  {
    files: ['e2e/**/*.ts', 'resources/**/*.mjs', 'resources/**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
