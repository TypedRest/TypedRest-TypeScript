/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  // jsdom is required for Blob() constructor and fetch()!
  testEnvironment: 'jsdom',
  testMatch: [
    "**/?(*.)+(spec|test).ts"
  ],
  transform: {
    "\\.ts$": "ts-jest"
  },
};
