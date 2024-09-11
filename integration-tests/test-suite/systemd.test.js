const Nrdb = require('./lib/nrdb');
const { v4: uuidv4 } = require('uuid');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');
const { executeSync, testOnlyIfSet, waitForLogMessageContaining } = require("./lib/test-util");

const causeJournaldMessageToBeWrittenForSsh = (uuid) => {
  // This _attempts_ to make an SSH connecting using the UUID as a user.
  // It will fail to connect, of course, since the UUID isn't a user,
  // but the attempt will be logged to journald for sshd with the name
  // of the user, so our log message will contain the UUID
  const command = 'ssh';
  const commandArguments = [
    // Force pseudo-terminal allocation, even though we're not a terminal
    // (otherwise SSH will not attempt to connect)
    '-t',
    // Don't get prompted whether we trust the host's authenticity
    // (since we're not a terminal and can't approve it, then SSH
    //  will not attempt to connect. And anyway, it's localhost,
    //  so we trust it :P)
    '-o',  'StrictHostKeyChecking=false',
    `${uuid}@localhost`];

    // It should return 255 because of "Permission denied"
    const expectedExitCode = 255;

  executeSync(command, commandArguments, expectedExitCode);
};

/**
 * This tests all things directly configurable from the Infrastructure Agent.
 *
 * See https://docs.newrelic.com/docs/logs/forward-logs/forward-your-logs-using-infrastructure-agent.
 */
describe('SYSTEMD unit input', () => {
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

  testOnlyIfSet('MONITORED_SYSTEMD_UNIT')('detects a log message in systemd', async () => {
    // This test currently only knows how to create ssh systemd logs
    const monitoredSystemdUnit = requireEnvironmentVariable('MONITORED_SYSTEMD_UNIT');
    expect(monitoredSystemdUnit).toMatch(/^ssh|sshd$/); // This is 'ssh' in some distros, 'sshd' in others

    // Create a unique string so that we can find the log message later
    const uuid = uuidv4();

    // Cause a message with the UUID to be written to journald
    // Should log something containing "input_userauth_request: invalid user ${uuid} [preauth]"
    causeJournaldMessageToBeWrittenForSsh(uuid);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(nrdb, uuid);
  });

});