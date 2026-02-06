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
  return new Promise((resolve, reject) => {
    logger.info(`Writing to TCP socket at 127.0.0.1:${port}...`);
    const socket = new Socket();

    // CRITICAL FIX: Fail test on connection error
    socket.on('error', (err) => {
      console.error('Syslog TCP Error:', err);
      socket.destroy();
      reject(err);
    });
     
    socket.connect({ port: parseInt(port), host: 'localhost' }, () => {
      socket.write(addNewlineSoFluentBitDetectsLine(line), () => {
        socket.end();
        resolve();
      });
    });
  });
};

const writeToUdpSocket = (port, line) => {
  return new Promise((resolve, reject) => {
    logger.info(`Writing to UDP socket at 127.0.0.1:${port}...`);
    const socket = dgram.createSocket('udp4');
    
    socket.on('error', (err) => {
        console.error('Syslog UDP Error:', err);
        socket.close();
        reject(err);
    });

    socket.send(
      addNewlineSoFluentBitDetectsLine(line),
      parseInt(port),
      'localhost', 
      (error) => {
        socket.close();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
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
    
    // Await the write
    await writeToTcpSocket(port, syslog);

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
    
    // Await the write
    await writeToUdpSocket(port, syslog);

    // Wait for that log line to show up in NRDB
    await waitForLogMessageContaining(nrdb, uuid);
  });

});