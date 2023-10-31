const logger = require('./lib/logger');
const Nrdb = require('./lib/nrdb');
const { Socket } = require('net');
const dgram = require('node:dgram');
const { v4: uuidv4 } = require('uuid');
const { currentTimeAsIso8601 } = require('./lib/time');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');
const { waitForLogMessageContaining, testOnlyIfSet } = require("./lib/test-util");

/**
 * The newline is important -- Fluent Bit will wait
 * until it sees a complete line before sending a log message
 */
const addNewlineSoFluentBitDetectsLine = (line) => `${line}\n`;

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

const rfc5424 = (message) => {
  return `<165>1 ${currentTimeAsIso8601()} example.com su - ID47 - ${message}`;
};

/**
 * This tests all things directly configurable from the Infrastructure Agent.
 *
 * See https://docs.newrelic.com/docs/logs/forward-logs/forward-your-logs-using-infrastructure-agent.
 */
describe('SYSLOG tests', () => {
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

  testOnlyIfSet('MONITORED_SYSLOG_RFC_5424_TCP_PORT')('detects writing to a TCP socket with a syslog RFC 5424 message', async () => {
    // Create a string with a unique value in it so that we can find it later
    const uuid = uuidv4();
    const message = `fluent-bit-tests: syslog (TCP socket - RFC 5424) ${uuid}`;
    const syslog = rfc5424(message);

    // Write that string to a TCP socket
    const port = requireEnvironmentVariable('MONITORED_SYSLOG_RFC_5424_TCP_PORT');
    writeToTcpSocket(port, syslog);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(nrdb, uuid);
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
    await waitForLogMessageContaining(nrdb, uuid);
  });

});