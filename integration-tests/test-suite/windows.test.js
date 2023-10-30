const Nrdb = require('./lib/nrdb');
const { v4: uuidv4 } = require('uuid');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');
const { spawnSync} = require("child_process");
const logger = require("./lib/logger");

const newNrdb = (configuration) => {
  return new Nrdb({
    accountId: configuration.accountId,
    apiKey: configuration.apiKey,
    nerdGraphUrl: configuration.nerdGraphUrl,
  });
};

const executeSync = (command, commandArguments, expectedExitCode) => {
  const result = spawnSync(command, commandArguments);

  logger.info(result.stdout?.toString());
  logger.error(result.stderr?.toString());
  expect(result.status).toEqual(expectedExitCode);
}

const createWindowsEventLogSource = (logName, source) => {
  const createEventSourceCommand = `[System.Diagnostics.EventLog]::CreateEventSource("${source}", "${logName}")`
  try {
    spawnSync('powershell', [createEventSourceCommand]);
  } catch (err) {
      logger.error('Error creating event log', err);
  }
}

const createWindowsEventLogMessage = (logName, source, message) => {
  const expectedExitCode = 0;
  const command = `Write-EventLog -LogName "${logName}" -Source "${source}" -EventID 3001 -EntryType Information -Message "${message}"`

  executeSync('powershell', [command], expectedExitCode);
}

const causeEventToBeWrittenToWindowsApplicationLog = (logName, source, message) => {
  // Create a source so that for debugging we can easily just look
  // at logs created by us (this is just a nice to have, we could also
  // just write as some existing source)
  createWindowsEventLogSource(logName, source);

  createWindowsEventLogMessage(logName, source, message);
}

/**
 * This tests all things directly configurable from the Infrastructure Agent.
 *
 * See https://docs.newrelic.com/docs/logs/forward-logs/forward-your-logs-using-infrastructure-agent.
 */
describe('Windows Infrastructure Agent Fluent Bit specific features', () => {
  let nrdb;

  beforeAll(() => {
    const accountId = requireEnvironmentVariable('ACCOUNT_ID');
    const apiKey = requireEnvironmentVariable('API_KEY');
    const nerdGraphUrl = requireEnvironmentVariable('NERD_GRAPH_URL');

    // Read configuration
    nrdb = newNrdb({ accountId, apiKey, nerdGraphUrl });

  });

  const waitForLogMessageContaining = async (substring) => {
    return nrdb.waitToFindOne({ where: `message like '%${substring}%'` });
  }

  const testOnlyIfSet = (environmentVariableName) => {
    return process.env[environmentVariableName] ? test : test.skip;
  }

  testOnlyIfSet('MONITORED_WINDOWS_LOG_NAME_USING_WINLOG')('detects a Windows event using "winlog" input plugin', async () => {
    // Create a unique string so that we can find the log message later
    const uuid = uuidv4();

    // Cause an event containing the UUID to be written to the Windows Event Log
    const monitoredLogName = requireEnvironmentVariable('MONITORED_WINDOWS_LOG_NAME_USING_WINLOG');
    const source = 'Fluent Bit Tests: winlog';
    const message = `fluent-bit-tests: winlog ${uuid}`;
    await causeEventToBeWrittenToWindowsApplicationLog(monitoredLogName, source, message);

    // Wait for that log line to show up in NRDB
    //
    // NOTE: this may take a while, since unlike winevtlog (which just reads
    // new events by default), winlog will read all events in the monitored log
    await waitForLogMessageContaining(message);
  });

  testOnlyIfSet('MONITORED_WINDOWS_LOG_NAME_USING_WINEVTLOG')('detects a Windows event using "winevtlog" input plugin', async () => {
    // Create a unique string so that we can find the log message later
    const uuid = uuidv4();

    // Cause an event containing the UUID to be written to the Windows Event Log
    const monitoredLogName = requireEnvironmentVariable('MONITORED_WINDOWS_LOG_NAME_USING_WINEVTLOG');
    const source = 'Fluent Bit Tests: winevtlog';
    const message = `fluent-bit-tests: winevtlog ${uuid}`;
    await causeEventToBeWrittenToWindowsApplicationLog(monitoredLogName, source, message);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(message);
  });
});