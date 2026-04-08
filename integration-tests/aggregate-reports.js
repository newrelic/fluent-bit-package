#!/usr/bin/env node

/**
 * Aggregates Fluent Bit installation reports from multiple test runs
 * Usage: node aggregate-reports.js [report-directory]
 */

const fs = require('fs');
const path = require('path');

function loadReports(reportDir) {
  const reports = [];

  try {
    const files = fs.readdirSync(reportDir);

    for (const file of files) {
      if (file.endsWith('.json') && file.includes('installation-report')) {
        const filePath = path.join(reportDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const report = JSON.parse(content);
          reports.push(report);
        } catch (error) {
          console.error(`Error reading ${file}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory: ${error.message}`);
  }

  return reports;
}

function generateMarkdownTable(reports) {
  if (reports.length === 0) {
    return '**No reports found**\n';
  }

  // Sort by distro, version, arch
  reports.sort((a, b) => {
    const aKey = `${a.environment.osDistro}-${a.environment.osVersion}-${a.environment.osArch}`;
    const bKey = `${b.environment.osDistro}-${b.environment.osVersion}-${b.environment.osArch}`;
    return aKey.localeCompare(bKey);
  });

  let markdown = '# Fluent Bit Installation Report\n\n';
  markdown += `**Generated:** ${new Date().toISOString()}\n\n`;
  markdown += `**Total Environments Tested:** ${reports.length}\n\n`;

  // Summary stats
  const fullyFunctional = reports.filter(r => r.summary.fullyFunctional).length;
  const versionMatch = reports.filter(r => r.summary.versionMatch).length;
  const withErrors = reports.filter(r => r.errors && r.errors.length > 0).length;

  markdown += '## Summary\n\n';
  markdown += `- ✅ Fully Functional: ${fullyFunctional}/${reports.length}\n`;
  markdown += `- ✅ Version Match: ${versionMatch}/${reports.length}\n`;
  markdown += `- ⚠️ With Errors/Warnings: ${withErrors}/${reports.length}\n\n`;

  // Detailed table
  markdown += '## Detailed Results\n\n';
  markdown += '| OS Distro | Version | Arch | Expected FB | Installed FB | Output Plugin | Service | Process | Status |\n';
  markdown += '|-----------|---------|------|-------------|--------------|---------------|---------|---------|--------|\n';

  for (const report of reports) {
    const distro = report.environment.osDistro;
    const version = report.environment.osVersion;
    const arch = report.environment.osArch;
    const expectedVer = report.versions.expected;
    const installedVer = report.versions.installed || 'N/A';
    const outputPlugin = report.versions.outputPlugin || 'N/A';
    const service = report.status.serviceRunning ? '✅' : '❌';
    const process = report.status.processRunning ? '✅' : '❌';

    let statusIcon = '✅';
    let statusText = 'OK';

    if (!report.summary.fullyFunctional) {
      statusIcon = '❌';
      statusText = 'Not Working';
    } else if (!report.summary.versionMatch) {
      statusIcon = '⚠️';
      statusText = 'Version Mismatch';
    } else if (report.errors && report.errors.length > 0) {
      statusIcon = '⚠️';
      statusText = 'Warnings';
    }

    markdown += `| ${distro} | ${version} | ${arch} | ${expectedVer} | ${installedVer} | ${outputPlugin} | ${service} | ${process} | ${statusIcon} ${statusText} |\n`;
  }

  // Issues section
  const reportsWithIssues = reports.filter(r =>
    !r.summary.fullyFunctional || !r.summary.versionMatch || (r.errors && r.errors.length > 0)
  );

  if (reportsWithIssues.length > 0) {
    markdown += '\n## Issues Detected\n\n';

    for (const report of reportsWithIssues) {
      const distro = `${report.environment.osDistro} ${report.environment.osVersion} (${report.environment.osArch})`;
      markdown += `### ${distro}\n\n`;

      if (!report.summary.fullyFunctional) {
        markdown += `- **Status:** Not Fully Functional\n`;
        if (!report.status.serviceRunning) markdown += `  - Service not running\n`;
        if (!report.status.processRunning) markdown += `  - Process not running\n`;
        if (report.versions.installed === 'not installed') markdown += `  - Fluent Bit not installed\n`;
      }

      if (!report.summary.versionMatch) {
        markdown += `- **Version Mismatch:** Expected ${report.versions.expected}, got ${report.versions.installed}\n`;
      }

      if (report.errors && report.errors.length > 0) {
        markdown += `- **Errors/Warnings:**\n`;
        report.errors.forEach(err => markdown += `  - ${err}\n`);
      }

      markdown += '\n';
    }
  }

  return markdown;
}

function generateJSONSummary(reports) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalEnvironments: reports.length,
    stats: {
      fullyFunctional: reports.filter(r => r.summary.fullyFunctional).length,
      versionMatch: reports.filter(r => r.summary.versionMatch).length,
      withErrors: reports.filter(r => r.errors && r.errors.length > 0).length
    },
    environments: reports.map(r => ({
      os: `${r.environment.osDistro} ${r.environment.osVersion} (${r.environment.osArch})`,
      expectedVersion: r.versions.expected,
      installedVersion: r.versions.installed,
      outputPlugin: r.versions.outputPlugin,
      fullyFunctional: r.summary.fullyFunctional,
      versionMatch: r.summary.versionMatch,
      errors: r.errors || []
    }))
  };

  return summary;
}

// Main execution
const reportDir = process.argv[2] || '/tmp';

console.log(`Aggregating reports from: ${reportDir}`);
const reports = loadReports(reportDir);

if (reports.length === 0) {
  console.error('No installation reports found!');
  process.exit(1);
}

console.log(`Found ${reports.length} reports\n`);

// Generate markdown
const markdown = generateMarkdownTable(reports);
const markdownPath = path.join(reportDir, 'fluent-bit-aggregate-report.md');
fs.writeFileSync(markdownPath, markdown);
console.log(`Markdown report written to: ${markdownPath}`);

// Generate JSON summary
const jsonSummary = generateJSONSummary(reports);
const jsonPath = path.join(reportDir, 'fluent-bit-aggregate-report.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonSummary, null, 2));
console.log(`JSON summary written to: ${jsonPath}`);

// Print to console
console.log('\n' + markdown);

// Exit with error code if any environment is not fully functional
const allGood = reports.every(r => r.summary.fullyFunctional);
process.exit(allGood ? 0 : 1);
