module.exports = {
  setupFilesAfterEnv: ['<rootDir>/setup-jest.js'],
  testEnvironment: 'node',
  reporters: [
    'jest-junit'
  ]
};
