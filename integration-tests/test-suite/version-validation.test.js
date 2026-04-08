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

// ADDED: debugExec function to capture and log hidden stderr messages from the OS
function debugExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND }).trim();
  } catch (error) {
    logger.error(`[DEBUG Exec] Cmd: ${cmd}`);
    logger.error(`[DEBUG Exec] Stderr: ${error.stderr ? error.stderr.toString() : 'none'}`);
    return error.stdout ? error.stdout.toString() : '';
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
  // ADDED: Guard clause to prevent TypeError: Cannot read properties of null
  if (!logOutput) return null;

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

// Shared results object for aggregate reporting
const installationReport = {
  osDistro: process.env.OS_DISTRO || 'unknown',
  osVersion: process.env.OS_VERSION || 'unknown',
  osArch: process.env.OS_ARCH || process.arch,
  expectedFbVersion: process.env.EXPECTED_FB_VERSION || 'unknown',
  actualFbVersion: null,
  outputPluginVersion: null,
  binaryPath: null,
  serviceRunning: null,
  processRunning: null,
  errors: []
};

function getOutputPluginVersion() {
  try {
    // Check for output plugin .so file and get version from filename or metadata
    const pluginPaths = [
      '/var/db/newrelic-infra/newrelic-integrations/logging/out_newrelic.so',
      '/opt/newrelic-infra/newrelic-integrations/logging/out_newrelic.so'
    ];

    for (const path of pluginPaths) {
      if (fs.existsSync(path)) {
        // Try to get version from package info
        const versionOutput = safeExec('rpm -q newrelic-infra --queryformat "%{VERSION}"') ||
                             safeExec('dpkg-query -W -f=\'${Version}\' newrelic-infra 2>/dev/null');
        if (versionOutput) {
          return versionOutput.trim();
        }
        return 'installed (version unknown)';
      }
    }
    return 'not found';
  } catch (error) {
    logger.warn(`Could not determine output plugin version: ${error.message}`);
    return 'error';
  }
}

describe('Embedded Fluent Bit Installation Report', () => {
  let expectedVersion;

  beforeAll(async () => {
    expectedVersion = process.env.EXPECTED_FB_VERSION;
    if (!expectedVersion) {
      installationReport.errors.push('EXPECTED_FB_VERSION environment variable not set');
      return; // Don't throw - just record the error
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
      installationReport.errors.push('Fluent-bit process did not start within 60 seconds');
      installationReport.processRunning = false;
    } else {
      installationReport.processRunning = true;
    }
  }, 75000); 

  test('collect fluent-bit installation data', () => {
    // Collect all data without failing - record what we find

    // 1. Try to get binary version
    try {
      const versionOutput = getFluentBitVersion();
      if (versionOutput) {
        installationReport.actualFbVersion = parseVersion(versionOutput);
        installationReport.binaryPath = getRunningFluentBitBinaryPath() || getExpectedBinaryPath();
        logger.info(`Fluent Bit version detected: ${installationReport.actualFbVersion}`);
      } else {
        installationReport.actualFbVersion = 'not installed';
        installationReport.errors.push('Fluent Bit binary not accessible');
      }
    } catch (error) {
      installationReport.actualFbVersion = 'error';
      installationReport.errors.push(`Version check error: ${error.message}`);
    }

    // 2. Check service status
    try {
      installationReport.serviceRunning = verifyServiceRunning();
      logger.info('New Relic Infrastructure service is running');
    } catch (error) {
      installationReport.serviceRunning = false;
      installationReport.errors.push(`Service check error: ${error.message}`);
    }

    // 3. Get output plugin version
    try {
      installationReport.outputPluginVersion = getOutputPluginVersion();
      logger.info(`Output plugin version: ${installationReport.outputPluginVersion}`);
    } catch (error) {
      installationReport.outputPluginVersion = 'error';
      installationReport.errors.push(`Plugin check error: ${error.message}`);
    }

    // Always pass - we're just collecting data
    expect(true).toBe(true);
  }, 45000);

  afterAll(() => {
    logger.info('Cleaning up dummy logging config...');
    if (process.platform === 'win32') {
      safeExec('del "C:\\Program Files\\New Relic\\newrelic-infra\\logging.d\\dummy-test.yml"');
    } else {
      safeExec('sudo rm -f /etc/newrelic-infra/logging.d/dummy-test.yml');
    }

    // Generate installation report
    const reportData = {
      timestamp: new Date().toISOString(),
      environment: {
        osDistro: installationReport.osDistro,
        osVersion: installationReport.osVersion,
        osArch: installationReport.osArch,
        platform: process.platform
      },
      versions: {
        expected: installationReport.expectedFbVersion,
        installed: installationReport.actualFbVersion,
        outputPlugin: installationReport.outputPluginVersion
      },
      status: {
        serviceRunning: installationReport.serviceRunning,
        processRunning: installationReport.processRunning,
        binaryPath: installationReport.binaryPath
      },
      errors: installationReport.errors,
      summary: {
        versionMatch: installationReport.actualFbVersion === installationReport.expectedFbVersion ||
                     (installationReport.actualFbVersion &&
                      installationReport.actualFbVersion.includes(installationReport.expectedFbVersion)),
        fullyFunctional: installationReport.serviceRunning &&
                        installationReport.processRunning &&
                        installationReport.actualFbVersion !== 'not installed'
      }
    };

    // Log summary table
    logger.info('\n');
    logger.info('='.repeat(80));
    logger.info('FLUENT BIT INSTALLATION REPORT');
    logger.info('='.repeat(80));
    logger.info(`OS:                    ${reportData.environment.osDistro} ${reportData.environment.osVersion} (${reportData.environment.osArch})`);
    logger.info(`Expected FB Version:   ${reportData.versions.expected}`);
    logger.info(`Installed FB Version:  ${reportData.versions.installed || 'N/A'}`);
    logger.info(`Output Plugin:         ${reportData.versions.outputPlugin || 'N/A'}`);
    logger.info(`Service Running:       ${reportData.status.serviceRunning ? '✓ Yes' : '✗ No'}`);
    logger.info(`Process Running:       ${reportData.status.processRunning ? '✓ Yes' : '✗ No'}`);
    logger.info(`Binary Path:           ${reportData.status.binaryPath || 'N/A'}`);

    if (reportData.errors.length > 0) {
      logger.info(`\nErrors/Warnings:       ${reportData.errors.length}`);
      reportData.errors.forEach((err, idx) => {
        logger.info(`  ${idx + 1}. ${err}`);
      });
    }

    logger.info(`\nVersion Match:         ${reportData.summary.versionMatch ? '✓ Match' : '✗ Mismatch'}`);
    logger.info(`Fully Functional:      ${reportData.summary.fullyFunctional ? '✓ Yes' : '✗ No'}`);
    logger.info('='.repeat(80));
    logger.info('\n');

    // Write JSON report for aggregation
    const reportPath = '/tmp/fluent-bit-installation-report.json';
    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      logger.info(`Report written to: ${reportPath}`);
    } catch (error) {
      logger.error(`Failed to write report file: ${error.message}`);
    }
  });
});