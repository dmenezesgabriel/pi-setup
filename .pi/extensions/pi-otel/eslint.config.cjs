module.exports = [
  // global ignores (replaces deprecated .eslintignore usage)
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.vscode/**'] },

  // Apply rules to TS and JS files
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      // Enforce readable, semantic identifier naming across the codebase
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variableLike',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
      ],

      // Allow console for now in the extension environment
      'no-console': 'off',

      // Cyclomatic complexity threshold
      'complexity': ['warn', { max: 10, variant: 'classic' }],
    },
  },
  // Disable complexity checks for tests (they often contain procedural flows)
  {
    files: ['tests/**'],
    rules: {
      'complexity': 'off',
    },
  },
];
