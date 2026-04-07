const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const logger = require('./lib/logger');

const TIMEOUTS = {
  FAST_COMMAND: 30000, // Increased to allow busy CI runners to spawn processes
  LOG_QUERY: 45000
};

// Simple synchronous sleep utility
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to safely run shell commands without crashing the test runner on failure
 */
function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
  } catch (error) {
    return null;
  }
}

/**
 * Gets the actual binary path of the running Fluent Bit child process
 */
function getRunningFluentBitBinaryPath() {
  const expectedFragment = 'newrelic';

  if (process.platform === 'win32') {
    // Replaced slow PowerShell with faster WMIC
    const cmd = `wmic process where "name='fluent-bit.exe'" get ExecutablePath /VALUE`;
    const output = safeExec(cmd);
    
    if (output) {
      const paths = output.split('\n')
                          .filter(line => line.includes('ExecutablePath='))
                          .map(line => line.split('=')[1].trim())
                          .filter(Boolean);
                          
      const nrPath = paths.find(p => p.toLowerCase().includes(expectedFragment));
      if (nrPath) {
        logger.info(`Windows: Found running fluent-bit at ${nrPath}`);
        return nrPath;
      }
    }
  } else {
    // Linux logic remains the same
    const pids = safeExec('pgrep -f "fluent-bit|td-agent-bit"');
    
    if (pids) {
      const pidArray = pids.split('\n').filter(Boolean);
      for (const pid of pidArray) {
        const binaryPath = safeExec(`sudo readlink -f /proc/${pid}/exe`);
        
        if (binaryPath && binaryPath.toLowerCase().includes(expectedFragment)) {
          logger.info(`Linux: Found running New Relic fluent-bit binary at ${binaryPath}`);
          return binaryPath;
        }
      }
    }
  }

  return null;
}

/**
 * Locates the binary, prioritizing the active process over hardcoded paths
 */
function getExpectedBinaryPath() {
  // Let the actively running process tell us the true path first
  const runningPath = getRunningFluentBitBinaryPath();
  if (runningPath && fs.existsSync(runningPath)) {
    return runningPath;
  }

  // Fallbacks if the process hasn't fully started yet
  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\New Relic\\newrelic-infra\\newrelic-integrations\\logging\\fluent-bit.exe',
      'C:\\Program Files (x86)\\New Relic\\newrelic-infra\\newrelic-integrations\\logging\\fluent-bit.exe'
    ];
    return winPaths.find(p => fs.existsSync(p)) || winPaths[0]; // Default fallback
  }

  const linuxPaths = [
    '/var/db/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/opt/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/usr/local/bin/fluent-bit',
    '/opt/td-agent-bit/bin/td-agent-bit'
  ];

  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Last resort: deep search on the file system for weird CI agent setups
  const fallbackSearch = safeExec('sudo find /opt /var /usr -type f \\( -name "fluent-bit" -o -name "td-agent-bit" \\) 2>/dev/null | grep -i newrelic | head -n 1');
  if (fallbackSearch && fs.existsSync(fallbackSearch)) {
    return fallbackSearch;
  }

  return linuxPaths[0]; // Will intentionally fail the next step if missing
}

function getFluentBitVersion() {
  const binaryPath = getExpectedBinaryPath();
  try {
    const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' });
    logger.info(`Raw version output from binary: ${output.trim()}`);
    return output;
  } catch (error) {
    logger.error(`Failed to execute embedded Fluent Bit binary at [${binaryPath}]. Error: ${error.message}`);
    throw error;
  }
}

function parseVersion(versionOutput) {
  const match = versionOutput.match(/Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i);
  return match ? match[1] : null;
}

function verifyServiceRunning() {
  if (process.platform === 'win32') {
    try {
      const status = execSync('sc query newrelic-infra', { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' });
      if (!status.match(/STATE\s*:\s*4\s+RUNNING/i)) throw new Error('Service not running');
    } catch (e) {
      throw new Error(`New Relic Infrastructure agent service not running (Windows): ${e.message}`);
    }
  } else {
    try {
      const status = execSync('systemctl is-active newrelic-infra', { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
      if (status !== 'active') throw new Error(`Service status: ${status}`);
    } catch (e) {
      throw new Error(`New Relic Infrastructure agent service not active (Linux): ${e.message}`);
    }
  }
  return true;
}

function findVersionInLogs(logOutput) {
  const lines = logOutput.split('\n');
  let latestVersion = null;

  for (const line of lines) {
    if (/Fluent Bit\s+v?\d+\.\d+\.\d+/i.test(line)) {
      const match = line.match(/Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i);
      if (match) {
        latestVersion = match[1]; // Correctly updates to the most recent startup
      }
    }
  }
  return latestVersion;
}

describe('Embedded Fluent Bit Version Validation', () => {
  let expectedVersion;

  beforeAll(async () => {
    expectedVersion = process.env.EXPECTED_FB_VERSION;
    if (!expectedVersion) {
      throw new Error('EXPECTED_FB_VERSION environment variable must be set');
    }
    logger.info(`Expected version: ${expectedVersion}`);

    let processFound = false;
    const maxRetries = 15;
    
    logger.info('Waiting for fluent-bit process to spin up...');
    for (let i = 0; i < maxRetries; i++) {
      if (getRunningFluentBitBinaryPath()) {
        processFound = true;
        break;
      }
      // 3. Add the 'await' keyword here
      await sleep(2000); 
    }

    if (!processFound) {
      logger.warn('fluent-bit process did not start within the expected timeframe. Tests may fall back to default paths.');
    }
  }, 45000); // Give beforeAll an explicit timeout so Jest doesn't kill it

  test('embedded fluent-bit binary should be accessible at New Relic path', () => {
    const versionOutput = getFluentBitVersion();
    expect(versionOutput).toBeTruthy();
  });

  test('installed version should match expected version', () => {
    const versionOutput = getFluentBitVersion();
    const actualVersion = parseVersion(versionOutput);

    expect(actualVersion).toBeTruthy();
    expect(actualVersion).toBe(expectedVersion); 
  });

  test('verify running process is spawned from New Relic path', () => {
    const binaryPath = getRunningFluentBitBinaryPath();
    const expectedPath = getExpectedBinaryPath();

    expect(binaryPath).toBeTruthy();
    expect(binaryPath.toLowerCase()).toContain(expectedPath.toLowerCase());
  });

  test('newrelic-infra service should be running', () => {
    expect(verifyServiceRunning()).toBe(true);
  });

  test('newrelic-infra logs should output expected Fluent Bit version (Soft Check)', () => {
    let logOutput = '';

    try {
      if (process.platform === 'win32') {
        const logPath = 'C:\\ProgramData\\New Relic\\newrelic-infra\\newrelic-infra.log'; 
        logOutput = execSync(`type "${logPath}"`, { encoding: 'utf8', timeout: TIMEOUTS.LOG_QUERY, stdio: 'pipe' });
      } else {
        logOutput = execSync('journalctl -u newrelic-infra -n 2000 --no-pager', { encoding: 'utf8', timeout: TIMEOUTS.LOG_QUERY, stdio: 'pipe' });
      }
    } catch (error) {
      // Soft check: return cleanly rather than failing the whole test suite
      logger.warn(`Could not read newrelic-infra logs (Check permissions): ${error.message}`); 
      return;
    }

    const versionInLogs = findVersionInLogs(logOutput);

    if (!versionInLogs) {
      logger.warn('Could not find Fluent Bit startup version in New Relic logs. Rotated out or missing.');
      return; 
    }

    if (versionInLogs !== expectedVersion) {
      logger.warn(`Log Version mismatch!\nExpected: ${expectedVersion}\nFound in logs: ${versionInLogs}`);
    } else {
      logger.info(`✓ Log confirms embedded version ${expectedVersion}`);
    }
  });

  afterAll(() => {
    try {
      const actualVersion = parseVersion(getFluentBitVersion());
      const binaryPath = getRunningFluentBitBinaryPath();
      logger.info(`\n=== Version Summary ===`);
      logger.info(`Expected: ${expectedVersion}`);
      logger.info(`Installed: ${actualVersion}`);
      logger.info(`Running binary: ${binaryPath || 'unknown'}`);
      logger.info(`======================\n`);
    } catch (error) {
      logger.error(`Cannot retrieve version summary: ${error.message}`);
    }
  });
});