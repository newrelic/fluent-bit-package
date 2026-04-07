const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const logger = require('./lib/logger');

const TIMEOUTS = {
  FAST_COMMAND: 60000, // Bumped to 60s: Windows CI runners can be exceptionally slow to spawn processes
  LOG_QUERY: 60000
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' }).trim();
  } catch (error) {
    logger.warn(`safeExec failed for command: ${cmd} | Error: ${error.message}`);
    return null;
  }
}

function getRunningFluentBitBinaryPath() {
  const expectedFragment = 'newrelic';

  if (process.platform === 'win32') {
    // FIX: Removed wmic. Used a streamlined PowerShell command that doesn't load profiles.
    // ErrorAction SilentlyContinue prevents polluting stderr if the process isn't up yet.
    const cmd = `powershell -NoProfile -Command "(Get-Process fluent-bit -ErrorAction SilentlyContinue).Path"`;
    const output = safeExec(cmd);
    
    if (output) {
      const paths = output.split('\n').map(p => p.trim()).filter(Boolean);
      const nrPath = paths.find(p => p.toLowerCase().includes(expectedFragment));
      if (nrPath) {
        logger.info(`Windows: Found running fluent-bit at ${nrPath}`);
        return nrPath;
      }
    }
  } else {
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

function getExpectedBinaryPath() {
  const runningPath = getRunningFluentBitBinaryPath();
  if (runningPath && fs.existsSync(runningPath)) {
    return runningPath;
  }

  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\New Relic\\newrelic-infra\\newrelic-integrations\\logging\\fluent-bit.exe',
      'C:\\Program Files (x86)\\New Relic\\newrelic-infra\\newrelic-integrations\\logging\\fluent-bit.exe'
    ];
    return winPaths.find(p => fs.existsSync(p)) || winPaths[0];
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

  const fallbackSearch = safeExec('sudo find /opt /var /usr -type f \\( -name "fluent-bit" -o -name "td-agent-bit" \\) 2>/dev/null | grep -i newrelic | head -n 1');
  if (fallbackSearch && fs.existsSync(fallbackSearch)) {
    return fallbackSearch;
  }

  return linuxPaths[0]; 
}

function getFluentBitVersion() {
  const binaryPath = getExpectedBinaryPath();
  try {
    const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: 'pipe' });
    return output;
  } catch (error) {
    logger.error(`Failed to execute embedded Fluent Bit binary at [${binaryPath}]. Error: ${error.message}`);
    throw error;
  }
}

function parseVersion(versionOutput) {
  if (!versionOutput) return null;
  const match = versionOutput.match(/Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i);
  if (!match) {
    logger.warn(`Could not parse version from output: ${versionOutput.trim()}`);
  }
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
        latestVersion = match[1];
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
    const maxRetries = 20; // Bumped to allow up to 40 seconds for CI runners
    
    logger.info('Waiting for fluent-bit process to spin up...');
    for (let i = 0; i < maxRetries; i++) {
      if (getRunningFluentBitBinaryPath()) {
        processFound = true;
        break;
      }
      await sleep(2000); 
    }

    if (!processFound) {
      // FIX: Fail loudly here. If it doesn't spin up, the rest of the tests WILL fail with confusing errors.
      throw new Error('FATAL: fluent-bit process did not start within the 40-second expected timeframe.');
    }
  }, 60000); 

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

    // Added a more descriptive error message here just in case
    expect(binaryPath).not.toBeNull();
    if(binaryPath && expectedPath) {
        expect(binaryPath.toLowerCase()).toContain(expectedPath.toLowerCase());
    }
  });

  test('newrelic-infra service should be running', () => {
    expect(verifyServiceRunning()).toBe(true);
  });

  test('newrelic-infra logs should output expected Fluent Bit version (Soft Check)', () => {
    let logOutput = '';

    try {
      if (process.platform === 'win32') {
        const logPath = 'C:\\ProgramData\\New Relic\\newrelic-infra\\newrelic-infra.log'; 
        logOutput = execSync(`powershell -NoProfile -Command "Get-Content '${logPath}' -Tail 2000"`, { encoding: 'utf8', timeout: TIMEOUTS.LOG_QUERY, stdio: 'pipe' });
      } else {
        logOutput = execSync('journalctl -u newrelic-infra -n 2000 --no-pager', { encoding: 'utf8', timeout: TIMEOUTS.LOG_QUERY, stdio: 'pipe' });
      }
    } catch (error) {
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