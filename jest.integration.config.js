// Jest para las pruebas de integración contra el Supabase local (npm run test:integration).
// Sin el preset de Expo: necesitan el fetch real de Node, que jest-expo reemplaza.

// babel-preset-expo viene como dependencia de expo (no está en la raíz de node_modules).
const babelPresetExpo = require.resolve('babel-preset-expo', {
  paths: [require.resolve('expo')],
});

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.integration.test.ts'],
  transform: { '\\.[jt]sx?$': ['babel-jest', { presets: [babelPresetExpo] }] },
};
