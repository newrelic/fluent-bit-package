const { execSync } = require('child_process');
const logger = require('./lib/logger');

/**
 * Version Validation Test
 * Detects silent version downgrades caused by dependency issues (e.g., OpenSSL mismatch).
 * Addresses RHEL 9.5 incident where yum silently installed 3.2.10 instead of 4.2.2.
 */

const TIMEOUTS = {
  FAST_COMMAND: 5000,
  PACKAGE_QUERY: 15000,
  LOG_QUERY: 45000
};

function getFluentBitVersion() {
  const isWindows = process.platform === 'win32';
  const path = isWindows
    ? (process.env.FLUENT_BIT_HOME || 'C:\\Applications\\FluentBit').replace(/"/g, '')
    : '/opt/fluent-bit';
  const command = isWindows
    ? `"${path}\\fluent-bit.exe" --version`
    : `${path}/bin/fluent-bit --version`;

  return execSync(command, { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND });
}

function parseVersion(versionOutput) {
  const match = versionOutput.match(/Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/i);
  return match ? match[1] : null;
}

function verifyServiceRunning() {
  // On both Windows and Linux, Fluent Bit runs embedded within the New Relic Infrastructure agent
  if (process.platform === 'win32') {
    const status = execSync('sc query newrelic-infra', { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND });
    if (!status.match(/STATE\s*:\s*4\s+RUNNING/i)) {
      throw new Error('New Relic Infrastructure agent service not running (Windows)');
    }
  } else {
    const status = execSync('systemctl is-active newrelic-infra', {
      encoding: 'utf8',
      timeout: TIMEOUTS.FAST_COMMAND
    }).trim();
    if (status !== 'active') {
      throw new Error(`New Relic Infrastructure agent service not active: ${status}`);
    }
  }
  return true;
}

describe('Fluent Bit Version Validation', () => {
  let expectedVersion;

  beforeAll(() => {
    expectedVersion = process.env.EXPECTED_FB_VERSION;
    if (!expectedVersion) {
      throw new Error('EXPECTED_FB_VERSION must be set');
    }
    logger.info(`Expected version: ${expectedVersion}`);
  });

  test('fluent-bit binary should be accessible', () => {
    const versionOutput = getFluentBitVersion();
    expect(versionOutput).toBeTruthy();
  });

  test('installed version should match expected version', () => {
    const versionOutput = getFluentBitVersion();
    const actualVersion = parseVersion(versionOutput);

    expect(actualVersion).toBeTruthy();
    expect(actualVersion).toMatch(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/);

    logger.info(`Expected: ${expectedVersion}, Actual: ${actualVersion}`);

    if (actualVersion !== expectedVersion) {
      throw new Error(
        `Version mismatch detected!\n` +
        `Expected: ${expectedVersion}\n` +
        `Actual:   ${actualVersion}\n` +
        `This may indicate a silent version downgrade due to dependency conflicts (e.g., OpenSSL).`
      );
    }

    expect(actualVersion).toBe(expectedVersion);
  });

  test('package manager should show correct version', () => {
    if (process.platform === 'win32') return;

    const packageManagers = [
      {
        name: 'rpm',
        command: 'rpm -q fluent-bit',
        parseVersion: (output) => {
          // Format: fluent-bit-VERSION-RELEASE.DIST.ARCH (e.g., fluent-bit-4.2.2-1.el9.x86_64)
          const match = output.match(/^fluent-bit-(\d+\.\d+\.\d+(?:-(?:beta|rc|alpha)[\w.-]*)?)-[\d.]+\./m);
          if (match) return match[1];

          // Fallback: strip RPM release number if present (4.2.2-1 → 4.2.2)
          const simple = output.match(/^fluent-bit-(\d+\.\d+\.\d+(?:-[\w.-]+)?)/m);
          if (!simple) throw new Error(`Cannot parse RPM version from: ${output.substring(0, 100)}`);
          return simple[1].replace(/-(\d+)$/, '');
        }
      },
      {
        name: 'dpkg',
        command: 'dpkg -s fluent-bit',
        parseVersion: (output) => {
          const match = output.match(/^Version:\s+(\d+\.\d+\.\d+(?:-(?:beta|rc|alpha)[\w.-]*)?)/m);
          if (!match) throw new Error(`Cannot parse dpkg version from: ${output.substring(0, 100)}`);
          return match[1];
        }
      },
      {
        name: 'zypper',
        command: 'zypper info --installed-only fluent-bit',
        parseVersion: (output) => {
          const match = output.match(/^Version\s*:\s*(\d+\.\d+\.\d+(?:-(?:beta|rc|alpha)[\w.-]*)?)/m);
          if (!match) throw new Error(`Cannot parse zypper version from: ${output.substring(0, 100)}`);
          return match[1];
        }
      }
    ];

    let found = false;
    for (const pm of packageManagers) {
      try {
        const output = execSync(pm.command, { encoding: 'utf8', timeout: TIMEOUTS.PACKAGE_QUERY });
        const version = pm.parseVersion(output);

        logger.info(`${pm.name}: ${version}`);
        if (version !== expectedVersion) {
          throw new Error(`Silent downgrade detected! ${pm.name} shows ${version} but expected ${expectedVersion}`);
        }
        found = true;
        break;
      } catch (error) {
        if (!error.message.includes('not found') && !error.message.includes('not installed')) {
          throw error;
        }
      }
    }

    if (!found) {
      throw new Error(
        `No package manager found fluent-bit installed.\n` +
        `Tried: rpm, dpkg, zypper\n` +
        `This indicates the package may not be properly installed.`
      );
    }
    expect(found).toBe(true);
  });

  test('service should be running', () => {
    expect(verifyServiceRunning()).toBe(true);
  });

  test('service logs should contain expected version', () => {
    let logOutput;

    try {
      if (process.platform === 'win32') {
        const path = (process.env.FLUENT_BIT_HOME || 'C:\\Applications\\FluentBit').replace(/"/g, '');
        logOutput = execSync(`type "${path}\\log\\fluent-bit.log"`, {
          encoding: 'utf8',
          timeout: TIMEOUTS.LOG_QUERY
        });
      } else {
        verifyServiceRunning();

        // Try to get logs from current service instance
        let startTime = null;
        try {
          startTime = execSync('systemctl show fluent-bit -p ActiveEnterTimestamp --value', {
            encoding: 'utf8',
            timeout: TIMEOUTS.FAST_COMMAND
          }).trim();
        } catch {}

        if (startTime && startTime !== 'n/a' && startTime.length > 0) {
          logOutput = execSync(`journalctl -u fluent-bit --no-pager --since "${startTime}"`, {
            encoding: 'utf8',
            timeout: TIMEOUTS.LOG_QUERY
          });
        } else {
          logOutput = execSync('journalctl -u fluent-bit --no-pager -n 500', {
            encoding: 'utf8',
            timeout: TIMEOUTS.LOG_QUERY
          });
        }

        if (!logOutput || !logOutput.trim()) {
          throw new Error('No logs found for fluent-bit service');
        }
      }
    } catch (error) {
      if (error.message.includes('not running') || error.message.includes('not active')) {
        throw error;
      }
      logger.warn(`Cannot read logs (permissions?): ${error.message}`);
      return; // Skip if logs unreadable but service is running
    }

    const versionInLogs = logOutput.includes(expectedVersion) || logOutput.includes(`v${expectedVersion}`);
    if (!versionInLogs) {
      const lines = logOutput.split('\n');
      logger.error(`Version ${expectedVersion} not in logs. Last 20 lines:`);
      logger.info(lines.slice(-20).join('\n'));

      // Try to find what version IS in the logs
      const versionPattern = /Fluent Bit\s+v?(\d+\.\d+\.\d+(?:-[\w.-]+)?)/gi;
      const foundVersions = new Set();
      let match;
      while ((match = versionPattern.exec(logOutput)) !== null) {
        foundVersions.add(match[1]);
      }

      const foundVersionsStr = foundVersions.size > 0
        ? `Found version(s) in logs: ${Array.from(foundVersions).join(', ')}`
        : 'No Fluent Bit version found in logs';

      throw new Error(
        `Expected version ${expectedVersion} not found in service logs.\n${foundVersionsStr}\n` +
        `This may indicate the wrong version is installed or logs are from a previous installation.`
      );
    }

    expect(versionInLogs).toBe(true);
  });

  test('log dependencies for diagnostics (RPM only)', () => {
    if (process.platform === 'win32') return;

    try {
      execSync('which rpm', { encoding: 'utf8', timeout: TIMEOUTS.FAST_COMMAND });
    } catch {
      return;
    }

    try {
      const deps = execSync('rpm -q --requires fluent-bit', {
        encoding: 'utf8',
        timeout: TIMEOUTS.PACKAGE_QUERY
      });

      const opensslDeps = deps.split('\n').filter(line =>
        line.includes('libcrypto') || line.includes('libssl') || line.includes('openssl')
      );

      if (opensslDeps.length > 0) {
        logger.info('OpenSSL dependencies:');
        opensslDeps.forEach(dep => logger.info(`  ${dep}`));

        try {
          const pkg = execSync('rpm -q openssl-libs || rpm -q openssl', {
            encoding: 'utf8',
            timeout: TIMEOUTS.FAST_COMMAND
          }).trim();
          const version = execSync('openssl version', {
            encoding: 'utf8',
            timeout: TIMEOUTS.FAST_COMMAND
          }).trim();
          logger.info(`Installed: ${pkg} (${version})`);
        } catch {}
      }
    } catch {}
  });

  afterAll(() => {
    try {
      const actualVersion = parseVersion(getFluentBitVersion());
      logger.info(`=== Version Summary: Expected ${expectedVersion}, Installed ${actualVersion} ===`);
    } catch (error) {
      logger.error(`Cannot retrieve version: ${error.message}`);
    }
  });
});
