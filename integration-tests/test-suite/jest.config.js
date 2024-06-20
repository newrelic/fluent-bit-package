const { WAIT_FOR_TEST_COMPLETION } = require('logging-integrations-test-lib/src/waitTimeConfig');

module.exports = {
  testTimeout: WAIT_FOR_TEST_COMPLETION,
  testFailureExitCode: 0,
  reporters: [
    'default',
    'jest-junit'
  ]
};
