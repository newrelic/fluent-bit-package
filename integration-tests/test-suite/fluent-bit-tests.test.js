const logger = require('./lib/logger');
const Nrdb = require('./lib/nrdb');
const fs = require('fs');
const { Socket } = require('net');
const dgram = require('node:dgram');
const { v4: uuidv4 } = require('uuid');
const { currentTimeAsIso8601 } = require('./lib/time');
const { spawnSync } = require('child_process');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');

/**
 * The newline is important -- Fluent Bit will wait
 * until it sees a complete line before sending a log message
 */
const addNewlineSoFluentBitDetectsLine = (line) => `${line}\n`;

const appendTo = (file, line) => {
  logger.info(`Appending to ${file}...`);
  fs.appendFileSync(file, addNewlineSoFluentBitDetectsLine(line));
};

const writeToTcpSocket = (port, line) => {
  logger.info(`Writing to TCP socket at localhost:${port}...`);
  const socket = new Socket();
  socket.on('error', console.error);
  socket.connect({ port }, () => {
    socket.write(addNewlineSoFluentBitDetectsLine(line));
    socket.end();
  });
};

const writeToUdpSocket = (port, line) => {
  logger.info(`Writing to UDP socket at localhost:${port}...`);
  const socket = dgram.createSocket('udp4');
  socket.send(
    addNewlineSoFluentBitDetectsLine(line),
    port,
    'localhost',
    (error) => {
      if (error) {
        console.error(error);
      }

      socket.close();
    });
};

const newNrdb = (configuration) => {
  return new Nrdb({
    accountId: configuration.accountId,
    apiKey: configuration.apiKey,
    nerdGraphUrl: configuration.nerdGraphUrl,
  });
};

const rfc5424 = (message) => {
  return `<165>1 ${currentTimeAsIso8601()} example.com su - ID47 - ${message}`;
};

const executeSync = (command, commandArguments, expectedExitCode) => {
  const result = spawnSync(command, commandArguments);
  
  expect(result.status).toEqual(expectedExitCode);
  logger.info(result.stdout?.toString());
  logger.error(result.stderr?.toString());
}

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

const createWindowsEventLogSource = (logName, source) => {
  const expectedExitCode = 0;
  const command = `[System.Diagnostics.EventLog]::CreateEventSource("${source}", "${logName}")`
  
  executeSync('powershell', [command], expectedExitCode);
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
describe('Infrastructure Agent Fluent Bit features', () => {
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

  testOnlyIfSet('MONITORED_FILE')('detects appending to a file', async () => {
    // Create a string with a unique value in it so that we can find it later 
    const uuid = uuidv4();
    const line = `fluent-bit-tests: tail ${uuid}`;

    // Append that string to our test log file
    const file = requireEnvironmentVariable('MONITORED_FILE');
    appendTo(file, line);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(uuid);
  });

  testOnlyIfSet('MONITORED_TCP_PORT')('detects writing to TCP port', async () => {
    // Create a string with a unique value in it so that we can find it later 
    const uuid = uuidv4();
    const line = `fluent-bit-tests: tcp ${uuid}`;

    // Write that string to the TCP socket
    const port = requireEnvironmentVariable('MONITORED_TCP_PORT');
    writeToTcpSocket(port, line);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(uuid);
  });

  testOnlyIfSet('MONITORED_SYSLOG_RFC_5424_TCP_PORT')('detects writing to a TCP socket with a syslog RFC 5424 message', async () => {
    // Create a string with a unique value in it so that we can find it later 
    const uuid = uuidv4();
    const message = `fluent-bit-tests: syslog (TCP socket - RFC 5424) ${uuid}`;
    const syslog = rfc5424(message);

    // Write that string to a TCP socket
    const port = requireEnvironmentVariable('MONITORED_SYSLOG_RFC_5424_TCP_PORT');
    writeToTcpSocket(port, syslog);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(uuid);
  });

  testOnlyIfSet('MONITORED_SYSLOG_RFC_5424_UDP_PORT')('detects writing to a UDP socket with a syslog RFC 5424 message', async () => {
    // Create a string with a unique value in it so that we can find it later 
    const uuid = uuidv4();
    const message = `fluent-bit-tests: syslog (UDP socket - RFC 5424) ${uuid}`;
    const syslog = rfc5424(message);

    // Write that string to a UDP socket
    const port = requireEnvironmentVariable('MONITORED_SYSLOG_RFC_5424_UDP_PORT');
    writeToUdpSocket(port, syslog);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(uuid);
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
    await waitForLogMessageContaining(uuid);
  });

  testOnlyIfSet('MONITORED_WINDOWS_LOG_NAME_USING_WINLOG')('detects a Windows event using "winlog" input plugin', async () => {
    // Create a unique string so that we can find the log message later
    const uuid = uuidv4();

    // Cause an event containing the UUID to be written to the Windows Event Log
    const monitoredLogName = requireEnvironmentVariable('MONITORED_WINDOWS_LOG_NAME_USING_WINLOG');
    const source = 'Fluent Bit Tests: winlog';
    const message = `fluent-bit-tests: winlog ${uuid}`;
    causeEventToBeWrittenToWindowsApplicationLog(monitoredLogName, source, message);

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
    causeEventToBeWrittenToWindowsApplicationLog(monitoredLogName, source, message);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(message);
  });
});