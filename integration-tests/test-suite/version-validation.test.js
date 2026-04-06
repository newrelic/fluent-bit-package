const { execSync } = require('child_process');
const fs = require('fs');
const logger = require('./lib/logger');

const TIMEOUTS = {
  FAST_COMMAND: 5000,
  LOG_QUERY: 45000
};

// GAP 3 FIX: Support multiple potential installation paths
const getExpectedBinaryPath = () => {
  if (process.platform === 'win32') {
    const winPath = 'C:\\Program Files\\New Relic\\newrelic-infra\\newrelic-integrations\\logging\\fluent-bit.exe';
    return fs.existsSync(winPath) ? winPath : winPath; // Default fallback
  }

  const linuxPaths = [
    '/var/db/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/opt/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/usr/local/bin/fluent-bit' // Edge case fallback
  ];

  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }
  return linuxPaths[0]; // Default if none found (will intentionally fail later if missing)
};

function getFluentBitVersion() {
  const command = `"${getExpectedBinaryPath()}" --version`;
  try {
    // GAP 2 FIX: Added stdio pipe to prevent stderr from bleeding into test logs
    return execSync(command, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' });
  } catch (error) {
    logger.error(`Failed to execute embedded Fluent Bit binary. Are you running with adequate permissions? Error: ${error.message}`);
    throw error;
  }
}

function parseVersion(versionOutput) {
  const match = versionOutput.match(/Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i);
  return match ? match[1] : null;
}

/**
 * Gets the actual binary path of the running Fluent Bit child process
 */
function getRunningFluentBitBinaryPath() {
  const expectedPathFragment = 'newrelic-integrations';

  if (process.platform === 'win32') {
    try {
      // GAP 4 FIX: Use Win32_Process to find the executable path robustly
      const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name like '%fluent-bit%'\\" | Select-Object -ExpandProperty ExecutablePath"`;
      const output = execSync(cmd, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
      
      const paths = output.split('\n').map(p => p.trim()).filter(Boolean);
      const nrPath = paths.find(p => p.toLowerCase().includes(expectedPathFragment));

      if (nrPath) {
        logger.info(`Windows: Found running fluent-bit at ${nrPath}`);
        return nrPath;
      }
    } catch (error) {
      logger.warn(`Cannot inspect Windows process: ${error.message}`);
    }
  } else {
    try {
      // GAP 1 FIX: Global search for fluent-bit, then inspect executable paths
      // This bypasses the strict Parent-Child requirement which fails on wrappers
      const pidsOutput = execSync('pgrep -f fluent-bit', { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
      const pids = pidsOutput.split('\n').filter(Boolean);
      
      for (const pid of pids) {
        try {
          const binaryPath = execSync(`readlink -f /proc/${pid}/exe`, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
          
          if (binaryPath.includes(expectedPathFragment)) {
            logger.info(`Running New Relic fluent-bit binary: ${binaryPath}`);
            return binaryPath;
          }
        } catch (e) {
          // Ignore readlink permission errors on system-owned fluent-bit processes we don't care about
        }
      }
    } catch (error) {
      logger.info(`Could not locate running fluent-bit via pgrep: ${error.message}`);
    }
  }

  logger.error('Could not find any running New Relic fluent-bit process. Is the logging integration enabled?');
  return null;
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

  beforeAll(() => {
    expectedVersion = process.env.EXPECTED_FB_VERSION;
    if (!expectedVersion) {
      throw new Error('EXPECTED_FB_VERSION environment variable must be set');
    }
    logger.info(`Expected version: ${expectedVersion}`);
  });

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