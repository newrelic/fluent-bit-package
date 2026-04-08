const { WAIT_FOR_TEST_COMPLETION } = require('./lib/waitTimes');

module.exports = {
  testTimeout: WAIT_FOR_TEST_COMPLETION,
  testFailureExitCode: 0,
  testSequencer: './testSequencer.js',
  reporters: [
    'default',
    'jest-junit'
  ]
};
