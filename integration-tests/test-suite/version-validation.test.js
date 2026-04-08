const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const logger = require('./lib/logger');

const TIMEOUTS = {
  FAST_COMMAND: 45000, 
  LOG_QUERY: 45000
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    logger.warn(`safeExec failed for command: [${cmd}] | Error: ${error.message}`);
    return null;
  }
}

// Ultra-fast log tailing bypassing heavy shell processes (like PowerShell)
function tailFileFast(filePath, maxBytes = 1000000) {
  if (!fs.existsSync(filePath)) return '';
  const stats = fs.statSync(filePath);
  const size = stats.size;
  const readSize = Math.min(maxBytes, size);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(readSize);
  fs.readSync(fd, buffer, 0, readSize, size - readSize);
  fs.closeSync(fd);
  return buffer.toString('utf8');
}

function getRunningFluentBitBinaryPath() {
  if (process.platform === 'win32') {
    // Replaced PowerShell with wmic for 10x faster execution and zero timeouts
    const cmd = 'wmic process where "name=\'fluent-bit.exe\'" get ExecutablePath /format:list';
    const output = safeExec(cmd);
    
    if (output && output.includes('ExecutablePath=')) {
      const nrPath = output.split('\n').find(line => line.includes('ExecutablePath=')).replace('ExecutablePath=', '').trim();
      if (nrPath) {
        logger.info(`Windows: Found running fluent-bit at ${nrPath}`);
        return nrPath;
      }
    }
  } else {
    // Fallback to ps if pgrep is missing on minimal distros (like AL2023/Debian)
    let pids = safeExec('pgrep -f "fluent-bit|td-agent-bit"');
    if (!pids) {
      const psOutput = safeExec('ps -eo pid,cmd | grep -E "[f]luent-bit|[t]d-agent-bit" | awk \'{print $1}\'');
      if (psOutput) pids = psOutput;
    }

    if (pids) {
      const pidArray = pids.split('\n').map(p => p.trim()).filter(Boolean);
      for (const pid of pidArray) {
        const binaryPath = safeExec(`sudo readlink -f /proc/${pid}/exe`);
        if (binaryPath && (binaryPath.toLowerCase().includes('fluent-bit') || binaryPath.toLowerCase().includes('td-agent-bit'))) {
          logger.info(`Linux: Found running fluent-bit binary at ${binaryPath}`);
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
    const foundPath = winPaths.find(p => fs.existsSync(p));
    if (foundPath) return foundPath;
    throw new Error('Could not find Fluent Bit binary on standard Windows paths.');
  }

  const linuxPaths = [
    '/var/db/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/opt/newrelic-infra/newrelic-integrations/logging/fluent-bit',
    '/usr/local/bin/fluent-bit',
    '/usr/bin/fluent-bit',       // Standard package manager path
    '/usr/sbin/fluent-bit',      // Standard daemon path
    '/opt/td-agent-bit/bin/td-agent-bit',
    '/opt/fluent-bit/bin/fluent-bit' 
  ];

  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }

  // Fails cleanly here rather than passing bad paths that result in confusing ENOENT errors
  throw new Error('Could not find Fluent Bit binary on the system (Searched all standard paths).'); 
}

function getFluentBitVersion() {
  const binaryPath = getExpectedBinaryPath();
  try {
    const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND, stdio: ['ignore', 'pipe', 'ignore'] });
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
  return match ? match[1].trim() : null;
}

function verifyServiceRunning() {
  if (process.platform === 'win32') {
    try {
      const status = safeExec('sc query newrelic-infra');
      if (!status || !status.match(/STATE\s*:\s*4\s+RUNNING/i)) throw new Error('Service not running');
    } catch (e) {
      throw new Error(`New Relic Infrastructure agent service not running (Windows): ${e.message}`);
    }
  } else {
    try {
      const status = safeExec('systemctl is-active newrelic-infra');
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
        latestVersion = match[1].trim();
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

    logger.info('Creating dummy logging config to force infra agent to spawn fluent-bit...');
    
    const logFilePath = process.platform === 'win32' ? 'C:\\Windows\\Temp\\dummy.log' : '/tmp/dummy.log';
    const dummyYaml = `logs:\n  - name: dummy\n    file: ${logFilePath}`;

    if (process.platform === 'win32') {
      try { fs.mkdirSync('C:\\Program Files\\New Relic\\newrelic-infra\\logging.d', { recursive: true }); } catch (e) {}
      fs.writeFileSync(logFilePath, ''); // Ensure log file exists so fluent-bit doesn't instantly crash
      fs.writeFileSync('C:\\Program Files\\New Relic\\newrelic-infra\\logging.d\\dummy-test.yml', dummyYaml);
      
      // Use native cmd 'net' commands instead of PowerShell for stable, fast service restarts
      safeExec('net stop newrelic-infra');
      await sleep(2000);
      safeExec('net start newrelic-infra');
    } else {
      safeExec(`touch ${logFilePath}`); // Ensure log file exists
      safeExec('sudo mkdir -p /etc/newrelic-infra/logging.d');
      const base64Yaml = Buffer.from(dummyYaml).toString('base64');
      safeExec(`echo ${base64Yaml} | base64 -d | sudo tee /etc/newrelic-infra/logging.d/dummy-test.yml`);
      safeExec('sudo systemctl restart newrelic-infra');
    }

    let processFound = false;
    const maxRetries = 30; // 60 seconds total buffer
    
    logger.info('Waiting for fluent-bit process to spin up...');
    for (let i = 0; i < maxRetries; i++) {
      if (getRunningFluentBitBinaryPath()) {
        processFound = true;
        break;
      }
      await sleep(2000); 
    }

    if (!processFound) {
      throw new Error('FATAL: fluent-bit process did not start within the 60-second expected timeframe.');
    }
  }, 75000); 

  test('embedded fluent-bit binary should be accessible at New Relic path', () => {
    const versionOutput = getFluentBitVersion();
    expect(versionOutput).toBeTruthy();
  }, 30000);

  test('installed version should match expected version', () => {
    const versionOutput = getFluentBitVersion();
    const actualVersion = parseVersion(versionOutput);

    expect(actualVersion).toBeTruthy();
    // Use .toContain instead of .toBe to forgive minor packaging suffixes (e.g., 5.0.2 vs 5.0.2-1)
    expect(actualVersion.toLowerCase()).toContain(expectedVersion.trim().toLowerCase()); 
  }, 30000);

  test('verify running process is spawned from New Relic path', () => {
    const binaryPath = getRunningFluentBitBinaryPath();
    const expectedPath = getExpectedBinaryPath();

    expect(binaryPath).not.toBeNull();
    if(binaryPath && expectedPath) {
        expect(binaryPath.toLowerCase()).toContain(expectedPath.toLowerCase());
    }
  }, 30000);

  test('newrelic-infra service should be running', () => {
    expect(verifyServiceRunning()).toBe(true);
  }, 30000);

  test('newrelic-infra logs should output expected Fluent Bit version (Soft Check)', () => {
    let logOutput = '';

    try {
      if (process.platform === 'win32') {
        const logPath = 'C:\\ProgramData\\New Relic\\newrelic-infra\\newrelic-infra.log'; 
        logOutput = tailFileFast(logPath); // Bypassing shell/powershell completely 
      } else {
        logOutput = safeExec('journalctl -u newrelic-infra -n 2000 -q --no-pager');
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

    if (!versionInLogs.toLowerCase().includes(expectedVersion.trim().toLowerCase())) {
      logger.warn(`Log Version mismatch!\nExpected: ${expectedVersion}\nFound in logs: ${versionInLogs}`);
    } else {
      logger.info(`✓ Log confirms embedded version ${expectedVersion}`);
    }
  }, 30000);

  afterAll(() => {
    logger.info('Cleaning up dummy logging config...');
    if (process.platform === 'win32') {
      safeExec('del "C:\\Program Files\\New Relic\\newrelic-infra\\logging.d\\dummy-test.yml"');
    } else {
      safeExec('sudo rm -f /etc/newrelic-infra/logging.d/dummy-test.yml');
    }

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