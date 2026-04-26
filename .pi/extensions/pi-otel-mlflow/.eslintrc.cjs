module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
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

    // Measure cyclomatic complexity (warn when a function exceeds the threshold)
    // Use the built-in `complexity` rule; accepts either a number or an options object
    // See: https://eslint.org/docs/latest/rules/complexity
    'complexity': ['warn', { 'max': 10, 'variant': 'classic' }],
  },
};
