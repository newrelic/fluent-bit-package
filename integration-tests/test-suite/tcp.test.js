const logger = require('./lib/logger');
const Nrdb = require('./lib/nrdb');
const { Socket } = require('net');
const dgram = require('node:dgram');
const { v4: uuidv4 } = require('uuid');
const { requireEnvironmentVariable } = require('./lib/environmentVariables');
const { testOnlyIfSet, waitForLogMessageContaining } = require("./lib/test-util");

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

/**
 * This tests all things directly configurable from the Infrastructure Agent.
 *
 * See https://docs.newrelic.com/docs/logs/forward-logs/forward-your-logs-using-infrastructure-agent.
 */
describe('TCP input', () => {
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

  testOnlyIfSet('MONITORED_TCP_PORT')('detects writing to TCP port', async () => {
    // Create a string with a unique value in it so that we can find it later
    const uuid = "456";
    const line = `fluent-bit-tests: tcp ${uuid}`;

    // Write that string to the TCP socket
    const port = requireEnvironmentVariable('MONITORED_TCP_PORT');
    writeToTcpSocket(port, line);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(nrdb, "123");
  });

});