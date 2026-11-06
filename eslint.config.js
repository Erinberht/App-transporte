// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'coverage/*']),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'jest.setup.js'],
    languageOptions: { globals: { jest: 'readonly' } },
  },
]);
