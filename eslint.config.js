// Flat ESLint config (ESLint 9) for the Vite + React + TS app.
//
// Philosophy: this codebase had no linter, so we gate CI on *correctness* rules
// (React hook rules, obviously-broken code) as errors, and surface stylistic /
// hygiene findings (unused vars, `any`, stray console) as warnings so they can
// be cleaned up incrementally without blocking the build on day one.
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // Only lint the app source. Everything else — the Python backend, build
  // output, vendored/minified JS, one-off Node scripts — is out of scope.
  {
    ignores: [
      'backend',
      'dist',
      'node_modules',
      'coverage',
      'api',
      'scripts',
      'pitch',
      'commercial',
      'public',
      '*.config.js',
      '*.config.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // Correctness — real bugs. Keep as errors (gate CI).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // Hygiene — surface, don't block. `_`-prefixed args/vars are intentional.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
