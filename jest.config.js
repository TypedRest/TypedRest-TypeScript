/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  // jsdom is required for Blob() constructor!
  testEnvironment: 'jsdom',
  testMatch: [
    "**/?(*.)+(spec|test).ts"
  ],
  transform: {
    './node_modules/url-template/lib/*.js': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};
