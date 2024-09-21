const logger = require('./lib/logger');
const Nrdb = require('./lib/nrdb');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');
const { testOnlyIfSet, waitForLogMessageContaining } = require("./lib/test-util");

/**
 * The newline is important -- Fluent Bit will wait
 * until it sees a complete line before sending a log message
 */
const addNewlineSoFluentBitDetectsLine = (line) => `${line}\n`;

const appendTo = (file, line) => {
  logger.info(`Appending to ${file}...`);
  fs.appendFileSync(file, addNewlineSoFluentBitDetectsLine(line));
};

/**
 * This tests all things directly configurable from the Infrastructure Agent.
 *
 * See https://docs.newrelic.com/docs/logs/forward-logs/forward-your-logs-using-infrastructure-agent.
 */
describe('TAIL input', () => {
  let nrdb;

  beforeAll(() => {
    const accountId = requireEnvironmentVariable('ACCOUNT_ID');
    const apiKey = requireEnvironmentVariable('API_KEY');
    const nerdGraphUrl = requireEnvironmentVariable('NERD_GRAPH_URL');

    // Read configuration
    nrdb = new Nrdb({
      accountId,
      apiKey,
      nerdGraphUrl,
    });

  });

  testOnlyIfSet('MONITORED_FILE')('detects appending to a file', async () => {
    // Create a string with a unique value in it so that we can find it later
    const uuid = "456";
    const line = `fluent-bit-tests: tail ${uuid}`;

    // Append that string to our test log file
    const file = requireEnvironmentVariable('MONITORED_FILE');
    appendTo(file, line);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(nrdb, "123");
  });

});