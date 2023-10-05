const { WAIT_FOR_TEST_COMPLETION } = require('./lib/waitTimes');

/**
 * Give Jest more time than the default 5 seconds. The Jest default is for
 * unit tests -- for E2E tests we want a far longer timeout.
 */
jest.setTimeout(WAIT_FOR_TEST_COMPLETION);

