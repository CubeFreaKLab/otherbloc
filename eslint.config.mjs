import js from '@eslint/js'
import globals from 'globals'
import hooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['node_modules/**', '**/dist/**', '.project/**', '.agent/**', '.firebase/**', '.local-data/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: { ecmaVersion: 'latest', globals: globals.node, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  { files: ['tests/browser/**/*.js', 'tests/e2e/**/*.js'], languageOptions: { globals: globals.browser } },
]
