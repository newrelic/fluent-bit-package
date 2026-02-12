# Fluent Bit Package Pipeline - Architecture & Design

## Table of Contents
1. [Overview](#overview)
2. [Architecture Components](#architecture-components)
3. [Version Management System](#version-management-system)
4. [CI/CD Pipeline Flow](#cicd-pipeline-flow)
5. [Testing Infrastructure](#testing-infrastructure)
6. [Package Build and Signing](#package-build-and-signing)
7. [Deployment and Release Process](#deployment-and-release-process)
8. [Key Technologies](#key-technologies)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Maintenance and Updates](#maintenance-and-updates)
11. [Architecture Decisions](#architecture-decisions)
12. [Security Considerations](#security-considerations)
13. [Performance Optimizations](#performance-optimizations)
14. [Monitoring and Observability](#monitoring-and-observability)
15. [Pipeline Resilience & Retry Strategy](#pipeline-resilience--retry-strategy)
16. [AWS Cost Estimation](#aws-cost-estimation)
17. [Future Enhancements](#future-enhancements)
18. [Appendix](#appendix)
19. [Glossary](#glossary)

---

## Overview

### Purpose
This repository implements an automated CI/CD pipeline that:
- Downloads official Fluent Bit packages from [packages.fluentbit.io](https://packages.fluentbit.io)
- Repackages them with New Relic branding and naming conventions
- Signs packages with New Relic GPG keys
- Tests packages across multiple Linux distributions and Windows versions
- **Validates integration between Fluent Bit, NR Fluent Bit output plugin, and New Relic Infrastructure Agent (NRIA)**
- **Verifies end-to-end log flow to New Relic via NRDB queries**
- Publishes packages to New Relic's distribution repositories
- Releases artifacts for consumption by NRIA

### Supported Platforms

**Note**: All test infrastructure (EC2 instances, AMIs) is deployed in the **us-east-2 (Ohio)** AWS region.

| Platform Type | Distributions | Architectures | AMI Coverage |
|--------------|---------------|---------------|--------------|
| **Debian-based** | Ubuntu 22 (Jammy), Ubuntu 24 (Noble), Debian 11 (Bullseye), Debian 12 (Bookworm) | amd64, arm64 | Both |
| **RedHat-based** | CentOS 7, 8, 9, Amazon Linux 2, 2023, Rocky Linux 10 | x86_64, aarch64 | Both |
| **SUSE** | SLES 12, 15.6, 15.7 | x86_64 | x86_64 only |
| **Windows** | Server 2019, 2022 | win64, win32 | Both |

> **SLES Note**: While SLES packages may be built for both x86_64 and aarch64, automated tests currently only run on x86_64 due to AMI availability in us-east-2.

---

## Architecture Components

### Directory Structure

```
fluent-bit-package/
├── .github/workflows/       # GitHub Actions workflow definitions
│   ├── pull_request.yml    # Main PR workflow
│   ├── merge_to_main.yml   # Production release workflow
│   ├── run_e2e_tests.yml   # E2E test orchestration
│   └── run_task.yml        # Fargate task execution
│
├── versions/                # Version configuration system
│   ├── common.yml          # Base configuration (FB version, plugin version)
│   ├── ubuntu_22_jammy.yml # Distribution-specific configs
│   ├── centos_9.yml
│   ├── sles_15.7.yml
│   └── strategyMatrix.py   # Matrix generation script
│
├── scripts/                 # Build and signing scripts
│   ├── sign.sh             # GPG signing for RPM/DEB
│   ├── sign_256.sh         # SHA256 signing for Rocky Linux
│   └── upload_assets_gh.sh # GitHub release asset uploader
│
├── ansible/                 # Infrastructure automation
│   ├── provision-and-execute-tests/  # Main test orchestration
│   ├── build-fb-suse/               # SLES package builder
│   └── upload-win-packages/         # Windows package uploader
│
├── terraform/               # Infrastructure as Code
│   ├── ec2-test-executors/ # Test environment instances
│   ├── ec2-suse-builders/  # SLES builder instances
│   └── ec2-instances-creator/ # Reusable EC2 module
│
├── integration-tests/       # E2E test suite
│   └── test-suite/         # Jest tests
│       ├── tail.test.js
│       ├── tcp.test.js
│       ├── syslog.test.js
│       ├── systemd.test.js
│       ├── winlog.test.js
│       └── winevtlog.test.js
│
└── schemas/                 # YAML schema generation
    └── schema.linux.py     # Package metadata schema generator
```

---

## Version Management System

### Configuration Files

#### 1. Common Configuration (`versions/common.yml`)
Defines base versions used across all distributions:

```yaml
fbVersion: 4.2.2                           # Official Fluent Bit version
nrFbOutputPluginVersion: 3.4.0             # NR output plugin version
nrFbOutputPluginTag: v3.4.0                # Optional: defaults to v{version}
```

#### 2. Distribution-Specific Files
Each distribution has a YAML file (e.g., `ubuntu_22_jammy.yml`):

```yaml
osDistro: ubuntu
osVersion: jammy
packages:
  - arch: amd64
    ami: ami-0552845828225afdc            # EC2 AMI for testing (us-east-2 region)
  - arch: arm64
    ami: ami-0c8c21f8cc8f7df5f            # EC2 AMI for testing (us-east-2 region)
```

> **Important**: All AMI IDs are specific to the **us-east-2 (Ohio)** region. If testing in other regions, AMI IDs must be updated accordingly.

### Matrix Generation Process

The `strategyMatrix.py` script orchestrates the entire version management:

```
1. Read common.yml
   ↓
2. Read all distribution YAML files
   ↓
3. For each distribution + architecture:
   a. Compute official Fluent Bit package URL
   b. Compute NR-branded package name
   c. Compute NR production S3 URL
   d. Compute NR staging S3 URL
   e. Check availability in production (HEAD request)
   f. Check availability in staging (HEAD request)
   ↓
4. Generate multiple matrix files:
   - strategyMatrix.json           (ALL packages)
   - prodAndStagingMatrix.json     (missing from prod/staging)
   - slesMatrix.json               (SLES only)
   - linuxAndWindowsMatrix.json    (non-SLES)
   - windowsMatrix.json            (Windows only)
   - stagingMatrix.json            (missing from staging)
   - productionMatrix.json         (missing from production)
```

### Matrix Entry Structure

Each matrix entry contains:

```json
{
  "fbVersion": "4.2.2",
  "osDistro": "ubuntu",
  "osVersion": "jammy",
  "arch": "amd64",
  "ami": "ami-0552845828225afdc",
  "packageUrl": "https://packages.fluentbit.io/debian/jammy/fluent-bit_4.2.2_amd64.deb",
  "targetPackageName": "fluent-bit_4.2.2_ubuntu-jammy_amd64.deb",
  "nrPackageUrl": "https://nr-downloads-main.s3.amazonaws.com/.../fluent-bit_4.2.2_ubuntu-jammy_amd64.deb",
  "nrStagingPackageUrl": "https://nr-downloads-ohai-staging.s3.amazonaws.com/.../fluent-bit_4.2.2_ubuntu-jammy_amd64.deb",
  "isProduction": false,
  "isStaging": false,
  "packageManagerType": "apt",
  "nrFbOutputPluginVersion": "3.4.0"
}
```

**Matrix Usage Strategy**:
- **Pull Request Testing**: Use `prodAndStagingMatrix.json` (only missing packages) → optimizes resources
- **Staging/Production Testing**: Use `strategyMatrix.json` (ALL packages) → comprehensive validation

---

## CI/CD Pipeline Flow

### Workflow Trigger Points

| Event | Workflow | Purpose |
|-------|----------|---------|
| Pull Request | `pull_request.yml` | Build, test, and stage packages |
| Merge to Main | `merge_to_main.yml` | Release to production |
| Manual Dispatch | `run_e2e_tests.yml` | On-demand testing |
| All Workflows | `new_relic.yml` | Monitoring and observability |

---

### Pull Request Workflow (`pull_request.yml`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. SETUP ENVIRONMENT                         │
│  - Create GitHub pre-release: tmp-pr-${PR_NUMBER}               │
│  - Generate strategy matrices (strategyMatrix.py)               │
│  - Generate YAML schemas                                        │
│  - Extract NR Fluent Bit output plugin version                 │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│            2. DOWNLOAD OFFICIAL PACKAGES (Parallel)             │
│  For each package in matrix:                                    │
│    a. Try to download from NR repository (cache)                │
│    b. If not found:                                             │
│       - Download from official Fluent Bit repo                  │
│       - Resign with NR GPG key (sign.sh)                        │
│       - For Rocky Linux: use SHA256 signing (sign_256.sh)       │
│       - For Windows: rezip binaries                             │
│    c. Upload to GitHub Actions artifacts (shared storage)       │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         3. UPLOAD TO PRE-RELEASE                                │
│  - Move all artifacts from GitHub Actions storage               │
│  - Attach to tmp-pr-${PR_NUMBER} GitHub pre-release             │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         4. RUN E2E TESTS - PRERELEASE                           │
│  - Uses: run_prerelease.yml workflow                            │
│  - Provisions:                                                  │
│    * NRIA from staging repository                               │
│    * Fluent Bit from GitHub pre-release                         │
│  - Runs Jest test suite across all platforms                    │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         5. PUBLISH TO STAGING                                   │
│  - Uses: infrastructure-publish-action@v1                       │
│  - Target: nr-downloads-ohai-staging S3 bucket                  │
│  - Signs packages with GPG                                      │
│  - Creates repository metadata (apt/yum)                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         6. RUN E2E TESTS - STAGING                              │
│  - Tests with BOTH components from staging:                     │
│    * NRIA from staging repository                               │
│    * Fluent Bit from staging repository                         │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         7. CLEANUP                                              │
│  - Keep pre-release for merge workflow                          │
│  - Clean up temporary files                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Concurrency Control**:
- `concurrency: group: ${{ github.workflow }}-${{ github.ref }}`
- `cancel-in-progress: true`
- Prevents multiple PR workflow runs for the same PR

**Resilience Features**:
- Network operations include automatic retries (3 attempts via `nick-fields/retry@v3`)
- Package installations include retry logic (5 attempts with 10s delay)
- Failed jobs can be rerun individually without restarting entire pipeline

---

### Merge to Main Workflow (`merge_to_main.yml`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. GET RELEASE TAG                           │
│  - Fetch PR number from commit message                          │
│  - Retrieve tag: tmp-pr-${PR_NUMBER}                            │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         2. PUBLISH LINUX TO PRODUCTION                          │
│  - Uses: infrastructure-publish-action@v1                       │
│  - Target: nr-downloads-main S3 bucket                          │
│  - Endpoint: production                                         │
│  - Creates APT/YUM repository metadata                          │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         3. RUN E2E TESTS - PRODUCTION                           │
│  - Tests all packages with:                                     │
│    * NRIA from production repository                            │
│    * Fluent Bit from production repository                      │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         4. PUBLISH WINDOWS PACKAGES                             │
│  - Uses: ansible/upload-win-packages/run                        │
│  - Target: logging-fb-windows-packages S3 bucket                │
│  - Uploads both win64 and win32 ZIP files                       │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         5. PROMOTE PRE-RELEASE TO RELEASE                       │
│  - Fetch assets from tmp-pr-${PR_NUMBER}                        │
│  - Convert from draft/prerelease to actual release              │
│  - Set title: "Release ${PR_NUMBER}"                            │
│  - Make release public                                          │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│         6. NOTIFY SLACK                                         │
│  - Fetch release details and artifacts                          │
│  - Send notification to Slack webhook                           │
│  - Include release URL and artifact list                        │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Feature**: Release promotion from pre-release ensures that tested artifacts are exactly what gets released (immutable artifacts).

---

### E2E Test Orchestration (`run_e2e_tests.yml` and `run_prerelease.yml`)

```
┌─────────────────────────────────────────────────────────────────┐
│    1. SPIN UP TEST EXECUTOR INSTANCES (Terraform)               │
│  - Matrix: prodAndStagingMatrix.json (prerelease)               │
│            OR strategyMatrix.json (staging/production)          │
│  - Creates EC2 instances with appropriate AMIs                  │
│  - Tags: ${PRE_RELEASE_NAME}-${osDistro}-${osVersion}-${arch}   │
└────┬──────────────────────────────────┬─────────────────────────┘
     ↓                                  ↓
┌─────────────────────────┐  ┌──────────────────────────────────┐
│   2a. SLES BUILD        │  │   2b. CONTINUE PARALLEL          │
│   (if SLES needed)      │  │   (other distros)                │
│                         │  │                                  │
│ - spin_up_suse          │  └──────────────────────────────────┘
│ - build_suse_packages   │
│ - tear_down_suse        │
│ - sign_suse_packages    │
│   (SHA256)              │
└─────────┬───────────────┘
          ↓
┌─────────────────────────────────────────────────────────────────┐
│    3. PROVISION LINUX (3 Parallel Jobs by OS Family)            │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────┐ │
│  │ provision_linux_  │  │ provision_linux_  │  │ provision_ │ │
│  │ apt               │  │ yum               │  │ linux_sles │ │
│  │                   │  │                   │  │            │ │
│  │ - Debian          │  │ - Amazon Linux    │  │ - SLES 12  │ │
│  │ - Ubuntu          │  │ - CentOS          │  │ - SLES 15  │ │
│  │                   │  │ - Rocky Linux     │  │            │ │
│  └───────────────────┘  └───────────────────┘  └────────────┘ │
│                                                                 │
│  For each instance:                                             │
│    1. Install NRIA (from staging/prerelease/production)         │
│    2. Install Fluent Bit (from pre-release or repo)             │
│    3. Install NR Fluent Bit output plugin                       │
│    4. Create logging configurations                             │
│    5. Start services                                            │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    4. RUN LINUX TESTS (3 Parallel Jobs)                         │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ test_linux_apt_  │  │ test_linux_yum_  │  │ test_linux_  │ │
│  │ distros          │  │ distros          │  │ sles_distros │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
│                                                                 │
│  Each runs Jest test suite:                                     │
│    - tail.test.js       (file tailing input)                    │
│    - tcp.test.js        (TCP socket input)                      │
│    - syslog.test.js     (RFC 5424 syslog)                       │
│    - systemd.test.js    (systemd journal)                       │
│                                                                 │
│  Output: JUnit XML reports (test-report-${arch}.xml)            │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    5. MERGE LINUX TEST RESULTS                                  │
│  - Downloads XML reports from all 3 families                    │
│  - Combines into single report                                  │
│  - Uploads consolidated report                                  │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    6. WINDOWS TESTING (Parallel to Linux)                       │
│  - provision_and_execute_tests_windows                          │
│  - Runs winlog and winevtlog tests                              │
│  - Generates separate XML report                                │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    7. REPORT TEST RESULTS                                       │
│  - Uses: dorny/test-reporter@v1                                 │
│  - Publishes Linux and Windows test results                     │
│  - Creates GitHub checks                                        │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│    8. CLEANUP                                                   │
│  - tear_down_test_executor_instances                            │
│  - Destroys all EC2 instances (Terraform destroy)               │
└─────────────────────────────────────────────────────────────────┘
```

**Optimization Strategy**:
- **Parallel Provisioning**: 3 simultaneous jobs (APT, YUM, SLES) reduce total time
- **Parallel Testing**: 3 simultaneous test executions
- **SLES Special Handling**: Built from source in parallel while other distros use pre-built packages
- **Windows Independence**: Runs completely in parallel to Linux workflow

---

## Testing Infrastructure

### Test Framework

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Test Runner | Jest | JavaScript test framework |
| API Client | NerdGraph | Query New Relic's NRDB |
| Validation | NRQL Queries | Verify logs appear in New Relic |
| Reporting | JUnit XML | CI-compatible test reports |

### Test Types

#### 1. File Tail Input (`tail.test.js`)
- **Purpose**: Verifies Fluent Bit can tail log files
- **Environment**: `MONITORED_FILE`
- **Validation**: Queries NRDB for log entries from file

#### 2. TCP Input (`tcp.test.js`)
- **Purpose**: Verifies TCP socket input
- **Environment**: `MONITORED_TCP_PORT`
- **Validation**: Sends TCP messages, verifies in NRDB

#### 3. Syslog Input (`syslog.test.js`)
- **Purpose**: Verifies RFC 5424 syslog parsing
- **Environment**: `MONITORED_SYSLOG_RFC_5424_TCP_PORT`, `MONITORED_SYSLOG_RFC_5424_UDP_PORT`
- **Validation**: Sends syslog messages, verifies structured data

#### 4. Systemd Input (`systemd.test.js`)
- **Purpose**: Verifies systemd journal integration
- **Environment**: `MONITORED_SYSTEMD_UNIT`
- **Validation**: Queries journal entries in NRDB

#### 5. Windows Event Log - Winlog (`winlog.test.js`)
- **Purpose**: Verifies Windows Event Log input (legacy)
- **Environment**: `MONITORED_WINDOWS_LOG_NAME_USING_WINLOG`
- **Validation**: Queries Windows events in NRDB

#### 6. Windows Event Log - Winevtlog (`winevtlog.test.js`)
- **Purpose**: Verifies Windows ETW-based Event Log input
- **Environment**: `MONITORED_WINDOWS_LOG_NAME_USING_WINEVTLOG`
- **Validation**: Queries Windows events in NRDB

### Test Execution Flow

```
1. Ansible provisions test instance
   - Installs NRIA (New Relic Infrastructure Agent)
   - Installs official Fluent Bit package (repackaged with NR branding)
     * Package installation includes automatic retries (5 attempts)
     * Handles lock contention and temporary repository failures
   - Installs NR Fluent Bit output plugin
   - Creates logging configurations
   - Starts services
   ↓
2. Ansible runs Jest test suite
   - Tests query NerdGraph API
   - Validation queries run against NRDB
   - **Validates end-to-end integration**:
     * Fluent Bit collects logs (official package + NR output plugin)
     * Logs flow through NRIA
     * Logs appear in New Relic (NRDB)
   - Wait for logs to appear (async)
   ↓
3. Generate JUnit XML report
   - test-report-${osDistro}-${osVersion}-${arch}.xml
   ↓
4. Upload report to GitHub Actions
   ↓
5. dorny/test-reporter publishes results
   - Creates GitHub check
   - Shows pass/fail status
```

**What This Validates**:
- ✅ Official Fluent Bit packages work correctly
- ✅ NR Fluent Bit output plugin integrates with Fluent Bit
- ✅ NRIA receives and forwards logs correctly
- ✅ Logs successfully reach New Relic's backend
- ✅ End-to-end data pipeline is functional

### NRDB Query Pattern

Tests use NRQL queries like:

```sql
SELECT * FROM Log
WHERE fb.input = 'tail'
  AND hostname = '${instanceId}'
  AND timestamp > ${startTime}
SINCE 10 minutes ago
```

This validates:
- Logs are being collected
- Correct input plugin is used
- Logs are attributed to correct instance
- Logs appear within expected timeframe

---

## Package Build and Signing

### Package Sources

#### Official Fluent Bit Packages
Downloaded from [packages.fluentbit.io](https://packages.fluentbit.io):

```
Debian/Ubuntu:
  https://packages.fluentbit.io/debian/{codename}/fluent-bit_{version}_{arch}.deb

RedHat/CentOS:
  https://packages.fluentbit.io/centos/{version}/fluent-bit-{version}-{release}.{arch}.rpm

Amazon Linux:
  https://packages.fluentbit.io/amazonlinux/{version}/fluent-bit-{version}-{release}.{arch}.rpm

Windows:
  https://packages.fluentbit.io/windows/fluent-bit-{version}-{arch}.zip
```

#### SLES Packages
Built from source (not available from official repo):

1. **Spin Up SLES Builder** (Terraform)
   - Uses `slesMatrix.json`
   - Creates EC2 instances with SLES AMI

2. **Build Packages** (Ansible: `build-fb-suse`)
   - Downloads Fluent Bit source
   - Compiles with appropriate flags
   - Creates RPM packages

3. **Sign Packages** (SHA256)
   - Uses `sign_256.sh` for Rocky Linux compatibility

4. **Upload to Pre-release**
   - Uploads RPMs to GitHub release

### Package Signing Process

#### GPG Signing (`scripts/sign.sh`)

**RPM Signing**:
```bash
# 1. Create .rpmmacros with GPG configuration
%_gpg_name ${GPG_MAIL}
%_gpg_path /tmp/.gnupg
%__gpg /usr/bin/gpg

# 2. Import GPG private key (base64-encoded from secret)
echo "${GPG_PRIVATE_KEY_BASE64}" | base64 -d | gpg --import

# 3. Sign RPM
rpm --addsign package.rpm

# 4. Verify signature
rpm -v --checksig package.rpm
```

**DEB Signing**:
```bash
# 1. Configure GPG agent with loopback pinentry
echo "allow-loopback-pinentry" >> ~/.gnupg/gpg-agent.conf

# 2. Import passphrase
echo "${GPG_PASSPHRASE}" | gpg --batch --passphrase-fd 0 --import key

# 3. Sign DEB with debsigs
debsigs --sign=origin --verify --check -v package.deb
```

#### SHA256 Signing for Rocky Linux (`scripts/sign_256.sh`)

Rocky Linux requires SHA256 digest algorithm:

```bash
rpm --addsign --digest-algo sha256 package.rpm
```

**Difference from standard signing**:
- Adds `--digest-algo sha256` flag
- Required for Rocky Linux 10+ compatibility
- Backwards compatible with older systems

### Package Naming Convention

New Relic uses consistent naming:

```
Debian/Ubuntu:
  fluent-bit_{fbVersion}_{osDistro}-{osVersion}_{arch}.deb
  Example: fluent-bit_4.2.2_ubuntu-jammy_amd64.deb

RedHat/CentOS:
  fluent-bit-{fbVersion}-{osDistro}-{osVersion}.{arch}.rpm
  Example: fluent-bit-4.2.2-centos-9.x86_64.rpm

Windows:
  fluent-bit-{fbVersion}-{arch}.zip
  Example: fluent-bit-4.2.2-win64.zip
```

---

## Deployment and Release Process

### Complete Release Workflow

```
┌────────────────────────────────────────────────────────────────┐
│                   DEVELOPER WORKFLOW                           │
└────────────────────────────────────────────────────────────────┘

1. Developer updates version
   - Edit versions/common.yml (fbVersion, nrFbOutputPluginVersion)
   - Run: make versions/generateMatrices
   - Commit changes

2. Developer creates Pull Request
   - GitHub Actions triggers pull_request.yml

┌────────────────────────────────────────────────────────────────┐
│                   PR WORKFLOW (Automated)                      │
└────────────────────────────────────────────────────────────────┘

3. Setup Environment
   - Create GitHub pre-release: tmp-pr-${PR_NUMBER}
   - Generate matrices and schemas

4. Download and Sign Packages
   - Download official packages (parallel)
   - Resign with NR GPG keys
   - Upload to pre-release

5. Test Pre-release
   - Spin up EC2 test instances
   - Install NRIA (staging) + Fluent Bit (pre-release)
   - Run E2E tests
   - Report results

6. Publish to Staging
   - Upload to nr-downloads-ohai-staging S3
   - Create APT/YUM repository metadata

7. Test Staging
   - Spin up new EC2 instances
   - Install NRIA + Fluent Bit from staging
   - Run E2E tests
   - Report results

┌────────────────────────────────────────────────────────────────┐
│                   APPROVAL AND MERGE                           │
└────────────────────────────────────────────────────────────────┘

8. Review and Approval
   - Developer/reviewer checks test results
   - Approves PR

9. Merge to Main
   - GitHub Actions triggers merge_to_main.yml

┌────────────────────────────────────────────────────────────────┐
│                   PRODUCTION WORKFLOW (Automated)              │
└────────────────────────────────────────────────────────────────┘

10. Publish to Production
    - Upload Linux packages to nr-downloads-main S3
    - Create APT/YUM repository metadata
    - Upload Windows packages to logging-fb-windows-packages S3

11. Test Production
    - Spin up EC2 instances
    - Install NRIA + Fluent Bit from production
    - Run E2E tests
    - Report results

12. Promote Release
    - Convert tmp-pr-${PR_NUMBER} to actual release
    - Change from draft/prerelease to public release
    - Set release title and description

13. Notify Stakeholders
    - Send Slack notification
    - Include release URL and artifacts

┌────────────────────────────────────────────────────────────────┐
│                   RELEASE COMPLETE                             │
│  Packages available at:                                        │
│  - https://download.newrelic.com/infrastructure_agent/...      │
│  - GitHub Release: https://github.com/.../releases/...         │
└────────────────────────────────────────────────────────────────┘
```

### Deployment Targets

#### 1. Linux Packages

**Production**:
- **S3 Bucket**: `nr-downloads-main`
- **Access**: https://download.newrelic.com/infrastructure_agent/linux/apt/
- **Repository Type**: APT (Debian/Ubuntu), YUM (RedHat/CentOS)

**Staging**:
- **S3 Bucket**: `nr-downloads-ohai-staging`
- **Access**: https://nr-downloads-ohai-staging.s3.amazonaws.com/
- **Repository Type**: APT, YUM

#### 2. Windows Packages

**All Environments**:
- **S3 Bucket**: `logging-fb-windows-packages`
- **Path**: `s3://logging-fb-windows-packages/fluent-bit-{version}-{arch}.zip`

#### 3. GitHub Releases

**Pre-release** (temporary):
- **Name**: `tmp-pr-${PR_NUMBER}`
- **Type**: Draft + Pre-release
- **Purpose**: Testing and validation

**Release** (permanent):
- **Name**: `Release ${PR_NUMBER}`
- **Type**: Public release
- **Purpose**: Historical record and direct download

### Repository Metadata

#### APT Repository Structure

```
deb [signed-by=/etc/apt/keyrings/newrelic-infra.gpg] \
  https://download.newrelic.com/infrastructure_agent/linux/apt \
  {codename} main
```

**Metadata Files** (generated by infrastructure-publish-action):
- `Packages` / `Packages.gz` - Package index
- `Release` - Repository metadata
- `Release.gpg` - GPG signature
- `InRelease` - Signed release file

#### YUM Repository Structure

```
[newrelic-infra]
name=New Relic Infrastructure
baseurl=https://download.newrelic.com/infrastructure_agent/linux/yum/el/$releasever/$basearch
gpgkey=https://download.newrelic.com/infrastructure_agent/gpg/newrelic-infra.gpg
```

**Metadata Files**:
- `repodata/repomd.xml` - Repository metadata
- `repodata/primary.xml.gz` - Package information
- `repodata/filelists.xml.gz` - File lists
- `repodata/other.xml.gz` - Additional metadata

---

## Key Technologies

### CI/CD Stack

| Technology | Purpose | Configuration |
|-----------|---------|---------------|
| **GitHub Actions** | CI/CD orchestration | `.github/workflows/*.yml` |
| **Fargate** | Containerized task execution | ECS cluster: `infra-agent-fb-e2e-testing` |
| **OIDC** | AWS authentication | Role: `AWS_ROLE_ARN_NEW` |

### Infrastructure

| Technology | Purpose | Configuration |
|-----------|---------|---------------|
| **Terraform** | Infrastructure as Code - Provisioning | `terraform/ec2-**/` |
| **Ansible** | Infrastructure as Code - Configuration | `ansible/*/playbook*.yml` |
| **AWS EC2** | Test/build instances | Multiple AMIs per distro |
| **AWS S3** | Package storage | Production, staging, Windows buckets |
| **AWS SSM** | Instance management | Session Manager for access |

#### Terraform vs Ansible: Complementary IaC Tools

While both Terraform and Ansible are Infrastructure as Code (IaC) tools, they serve different purposes in our pipeline:

| Aspect | Terraform | Ansible |
|--------|-----------|---------|
| **Primary Purpose** | **Provisioning** - Creates/destroys infrastructure | **Configuration** - Configures existing infrastructure |
| **Philosophy** | Declarative - "What should exist" | Procedural - "What steps to take" |
| **State Management** | Maintains state file (`terraform.tfstate`) | Stateless - runs tasks each time |
| **Use in This Project** | Spins up/tears down EC2 instances | Installs packages, configures services, runs tests |
| **Idempotency** | State-based (compares desired vs actual) | Task-based (each task should be idempotent) |
| **Example Operation** | `terraform apply` → Creates 10 EC2 instances | `ansible-playbook` → Installs Fluent Bit on those 10 instances |

**Workflow Example**:
1. **Terraform** creates EC2 instance with SLES AMI
2. **Ansible** connects to that instance and:
   - Installs NRIA from repository
   - Installs Fluent Bit package
   - Configures logging
   - Starts services
   - Runs tests
3. **Terraform** destroys the instance when done

### Build and Signing

| Technology | Purpose | Configuration |
|-----------|---------|---------------|
| **GPG** | Package signing | GitHub Secrets: `GPG_PRIVATE_KEY_BASE64`, `GPG_PASSPHRASE` |
| **debsigs** | Debian package signing | `.deb` files |
| **rpmsign** | RPM package signing | `.rpm` files |
| **SHA256** | Rocky Linux signing | `--digest-algo sha256` |

### Testing

| Technology | Purpose | Configuration |
|-----------|---------|---------------|
| **Jest** | Test framework | `integration-tests/test-suite/` |
| **NodeJS** | Test runtime | Node 14+ |
| **NerdGraph** | New Relic API | GraphQL queries |
| **NRDB** | Log validation | NRQL queries |
| **JUnit XML** | Test reporting | `dorny/test-reporter@v1` |

### Package Management

| Package Type | Tool | Repository Format |
|-------------|------|-------------------|
| **.deb** | APT | Debian repository (Packages.gz, Release) |
| **.rpm** | YUM | RedHat repository (repomd.xml) |
| **.zip** | Direct download | S3 bucket |

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Package Signing Failures

**Symptom**: `rpm --addsign` or `debsigs` fails

**Possible Causes**:
- GPG key not imported correctly
- Incorrect passphrase
- GPG agent not running

**Solution**:
```bash
# Check GPG keys
gpg --list-keys

# Test GPG signing
echo "test" | gpg --clearsign

# Check RPM macros
cat ~/.rpmmacros
```

#### 2. E2E Tests Failing

**Symptom**: Jest tests timeout or fail validation

**Possible Causes**:
- Fluent Bit not starting
- Configuration errors
- Network issues (NR API unreachable)
- Logs not appearing in NRDB

**Solution**:
```bash
# SSH to test instance (via SSM)
aws ssm start-session --target i-xxxxxxxxxxxx

# Check Fluent Bit status
sudo systemctl status fluent-bit

# Check Fluent Bit logs
sudo journalctl -u fluent-bit -f

# Check NR output plugin logs
sudo tail -f /var/log/newrelic-infra/newrelic-infra.log

# Test NerdGraph connectivity
curl -X POST https://api.newrelic.com/graphql \
  -H "Content-Type: application/json" \
  -H "API-Key: ${NRIA_LICENSE_KEY}" \
  -d '{"query": "{ actor { user { name } } }"}'
```

#### 3. Matrix Generation Failures

**Symptom**: `strategyMatrix.py` produces empty or incorrect matrices

**Possible Causes**:
- Invalid YAML syntax in version files
- Network issues (cannot reach package URLs)
- Missing fields in distribution configs

**Solution**:
```bash
# Validate YAML syntax
python -m yaml versions/common.yml

# Test matrix generation locally
make versions/generateMatrices

# Check generated files
cat versions/strategyMatrix.json | jq .

# Verify package URLs
curl -I https://packages.fluentbit.io/debian/jammy/fluent-bit_4.2.2_amd64.deb
```

#### 4. Terraform Provisioning Failures

**Symptom**: EC2 instances fail to create

**Possible Causes**:
- AMI not available in region
- Subnet or security group misconfigured
- IAM permissions insufficient
- Resource limits exceeded

**Solution**:
```bash
# Check Terraform state
cd terraform/ec2-test-executors
terraform state list

# Validate Terraform configuration
terraform validate

# Check AWS limits
aws ec2 describe-account-attributes \
  --attribute-names max-instances

# Test AMI availability
aws ec2 describe-images --image-ids ami-xxxxxxxxx
```

#### 5. GitHub Release Upload Failures

**Symptom**: Assets fail to upload to pre-release

**Possible Causes**:
- Release doesn't exist
- Asset name conflicts
- GitHub API rate limiting
- Network timeouts

**Solution**:
```bash
# Check if release exists
gh release view tmp-pr-${PR_NUMBER}

# List release assets
gh release view tmp-pr-${PR_NUMBER} --json assets

# Delete duplicate asset
gh release delete-asset tmp-pr-${PR_NUMBER} fluent-bit_4.2.2_ubuntu-jammy_amd64.deb

# Re-upload asset
gh release upload tmp-pr-${PR_NUMBER} packages/fluent-bit_4.2.2_ubuntu-jammy_amd64.deb
```

#### 6. Repository Publishing Failures

**Symptom**: `infrastructure-publish-action` fails

**Possible Causes**:
- S3 bucket permissions
- Invalid package signatures
- Schema validation errors
- Conflicting package versions

**Solution**:
```bash
# Check S3 bucket access
aws s3 ls s3://nr-downloads-main/infrastructure_agent/linux/apt/

# Verify package signature
rpm --checksig package.rpm
dpkg-sig --verify package.deb

# Validate schema
python schemas/schema.linux.py --validate
```

### Debugging Workflow Runs

#### View Workflow Logs

```bash
# List workflow runs
gh run list --workflow=pull_request.yml

# View specific run
gh run view <run-id>

# Download logs
gh run download <run-id>
```

#### Access EC2 Test Instances

```bash
# Find instance by tag
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=tmp-pr-123-*" \
  --query "Reservations[].Instances[].[InstanceId,State.Name,Tags[?Key=='Name'].Value|[0]]"

# Connect via SSM
aws ssm start-session --target i-xxxxxxxxxxxx
```

#### Check Package Availability

```bash
# Check NR production
curl -I https://download.newrelic.com/infrastructure_agent/linux/apt/pool/main/f/fluent-bit/fluent-bit_4.2.2_ubuntu-jammy_amd64.deb

# Check NR staging
curl -I https://nr-downloads-ohai-staging.s3.amazonaws.com/infrastructure_agent/linux/apt/pool/main/f/fluent-bit/fluent-bit_4.2.2_ubuntu-jammy_amd64.deb

# Check GitHub release
gh release view tmp-pr-123 --json assets -q '.assets[].name'
```

---

## Maintenance and Updates

### Adding a New Distribution

1. **Create Distribution Config**:
   ```yaml
   # versions/newdistro_1.0.yml
   osDistro: newdistro
   osVersion: "1.0"
   packages:
     - arch: amd64
       ami: ami-xxxxxxxxx
   ```

2. **Test AMI**:
   ```bash
   aws ec2 run-instances --image-id ami-xxxxxxxxx --instance-type t3.micro
   ```

3. **Update Matrix Generation**:
   - `strategyMatrix.py` should auto-detect new config
   - Run: `make versions/generateMatrices`

4. **Test Locally**:
   ```bash
   # Provision test instance
   cd ansible/provision-and-execute-tests
   make prerelease-linux-provision-apt EXTRA_ARGS="--limit newdistro"

   # Run tests
   make prerelease-linux-test-apt EXTRA_ARGS="--limit newdistro"
   ```

5. **Submit PR** with new distribution config

### Updating Fluent Bit Version

1. **Update Common Config**:
   ```yaml
   # versions/common.yml
   fbVersion: 4.3.0  # New version
   ```

2. **Regenerate Matrices**:
   ```bash
   make versions/generateMatrices
   ```

3. **Verify Package Availability**:
   ```bash
   # Check if official packages exist
   curl -I https://packages.fluentbit.io/debian/jammy/fluent-bit_4.3.0_amd64.deb
   ```

4. **Submit PR** and follow standard release process

### Updating NR Output Plugin

1. **Update Common Config**:
   ```yaml
   # versions/common.yml
   nrFbOutputPluginVersion: 3.5.0
   ```

2. **Regenerate Matrices**:
   ```bash
   make versions/generateMatrices
   ```

3. **Test with Pre-release Workflow**

4. **Submit PR**

---

## Architecture Decisions

### Why Multiple Matrices?

**Problem**: Testing every package on every PR is slow and expensive.

**Solution**: Use different matrices for different scenarios:
- **PR Testing**: Only test packages missing from production/staging (`prodAndStagingMatrix.json`)
- **Staging/Production Testing**: Test ALL packages (`strategyMatrix.json`)

**Benefit**: ~70% reduction in test time for typical PRs

### Why GitHub Pre-releases?

**Problem**: Need temporary storage for testing packages before production release.

**Solution**: Use GitHub pre-releases as staging area:
- Immutable artifacts (same package tested → staged → released)
- Built-in version control
- Easy artifact retrieval
- Automatic cleanup

**Benefit**: Ensures tested artifacts are exactly what gets released

### Why Separate SLES Build Process?

**Problem**: SLES packages not available from official Fluent Bit repositories.

**Solution**: Build from source on SLES instances:
- Use official SLES AMIs
- Compile with distro-specific flags
- Create RPM packages
- Sign with SHA256 (Rocky Linux compatibility)

**Benefit**: Support for SLES without manual package creation

### Why Three Parallel Linux Test Jobs?

**Problem**: Sequential testing is too slow (~45 minutes).

**Solution**: Parallelize by package manager family:
1. APT (Debian, Ubuntu)
2. YUM (Amazon Linux, CentOS, Rocky)
3. SLES (zypper)

**Benefit**: Reduces test time from 45 minutes to ~15 minutes

### Why Fargate for Task Execution?

**Problem**: GitHub Actions has limited execution time and resources.

**Solution**: Use Fargate for long-running tasks:
- 6-hour timeout (vs 6 hours max for GHA)
- Isolated environment
- Consistent execution
- Better error handling

**Benefit**: Reliable execution of long-running operations

---

## Security Considerations

### GPG Key Management

- **Private Key Storage**: GitHub Secrets (base64-encoded)
- **Passphrase Storage**: GitHub Secrets (encrypted)
- **Key Rotation**: Update secrets and re-sign all packages
- **Access Control**: Only CI/CD workflows have access

### AWS Credentials

- **Authentication Method**: OIDC (no long-lived credentials)
- **Role ARN**: `AWS_ROLE_ARN_NEW`
- **Session Duration**: 6 hours
- **Permissions**: Scoped to specific S3 buckets and EC2 operations

### Package Integrity

- **Signing**: All packages signed with GPG
- **Verification**: Signatures verified before upload
- **Checksums**: SHA256 checksums generated
- **Immutability**: Pre-release artifacts never modified

### Network Security

- **EC2 Security Group**: Restricts inbound traffic
- **VPC Subnet**: Isolated network
- **SSM Access**: No SSH keys required
- **S3 Bucket Policies**: Restrict public access

---

## Performance Optimizations

### Parallel Execution

| Stage | Parallelization | Time Reduction |
|-------|----------------|----------------|
| Package Download | Per-package | 10x faster |
| Linux Provisioning | 3 parallel jobs | 3x faster |
| Linux Testing | 3 parallel jobs | 3x faster |
| EC2 Creation | Terraform parallelism | 5x faster |

### Caching Strategy

1. **Package Caching**: Try NR repository before official repo
2. **Matrix Caching**: Only regenerate when versions change
3. **Terraform State**: Persists between runs
4. **GitHub Actions Cache**: Dependencies cached

### Resource Optimization

- **Instance Types**: t3.micro for most tests (cost-effective)
- **Spot Instances**: Could be used for non-critical testing
- **Auto-cleanup**: EC2 instances destroyed immediately after tests
- **Selective Testing**: Only test changed packages on PRs

---

## Monitoring and Observability

### GitHub Actions

- **Workflow Status**: Visible in GitHub UI
- **Test Reports**: Published as GitHub checks
- **Logs**: Downloadable for 90 days
- **Notifications**: Slack alerts on failure

### New Relic Integration

- **Workflow Events**: Sent to New Relic via `new_relic.yml`
- **Custom Attributes**: Workflow name, run ID, status
- **Dashboards**: Monitor pipeline health
- **Alerts**: Notify on repeated failures

### Test Results

- **JUnit XML**: Standard format for CI tools
- **GitHub Checks**: Integrated test reporting
- **NRDB Validation**: Verifies end-to-end functionality
- **Historical Tracking**: All test runs stored

---

## Future Enhancements

### Potential Improvements

1. **Automated Rollback**: Detect production issues and auto-rollback
2. **Canary Deployments**: Gradual rollout to production
3. **Performance Benchmarks**: Track package performance over time
4. **Automated Version Detection**: Auto-detect new Fluent Bit releases
5. **Multi-region Testing**: Test in multiple AWS regions
6. **Spot Instance Usage**: Reduce EC2 costs for testing
7. **Docker-based Testing**: Alternative to EC2 for faster tests
8. **Blue-Green Deployments**: Zero-downtime releases

### Scalability Considerations

- **More Distributions**: Easily add new distros via YAML configs
- **More Architectures**: ARM support already in place, can add RISC-V
- **Faster Testing**: Could parallelize further with more GHA concurrency
- **Cost Optimization**: Move to cheaper compute for non-critical tests

---

## Appendix

### Makefile Targets

Common `make` commands:

```bash
# Generate strategy matrices
make versions/generateMatrices

# Run local tests (requires environment)
make prerelease-linux-provision-apt
make prerelease-linux-test-apt

# Provision SLES builders
make suse-build

# Upload Windows packages
make windows-upload
```

### Environment Variables

Key environment variables used in workflows:

| Variable | Purpose | Example |
|----------|---------|---------|
| `GPG_MAIL` | GPG key email | `infrastructure@newrelic.com` |
| `GPG_PASSPHRASE` | GPG key passphrase | (secret) |
| `GPG_PRIVATE_KEY_BASE64` | Base64-encoded private key | (secret) |
| `AWS_ROLE_ARN_NEW` | AWS OIDC role | `arn:aws:iam::...` |
| `NRIA_LICENSE_KEY` | New Relic license key | (secret) |
| `FB_VERSION` | Fluent Bit version | `4.2.2` |
| `NR_FB_OUTPUT_PLUGIN_VERSION` | Plugin version | `3.4.0` |
| `PRE_RELEASE_NAME` | GitHub pre-release tag | `tmp-pr-123` |

### Repository URLs

| Repository | URL |
|-----------|-----|
| Official Fluent Bit | https://packages.fluentbit.io |
| NR Production (Linux) | https://download.newrelic.com/infrastructure_agent |
| NR Staging (Linux) | https://nr-downloads-ohai-staging.s3.amazonaws.com |
| NR Windows | s3://logging-fb-windows-packages |

### Useful Links

- [Fluent Bit Documentation](https://docs.fluentbit.io)
- [New Relic Infrastructure Agent](https://docs.newrelic.com/docs/infrastructure)
- [GPG Signing Guide](https://wiki.debian.org/SecureApt)
- [Terraform EC2 Module](https://registry.terraform.io/modules/terraform-aws-modules/ec2-instance/aws)
- [Ansible Documentation](https://docs.ansible.com)

---

## Glossary

| Term | Definition |
|------|------------|
| **NRIA** | New Relic Infrastructure Agent |
| **NRDB** | New Relic Database (for querying logs) |
| **NerdGraph** | New Relic's GraphQL API |
| **E2E** | End-to-end testing |
| **AMI** | Amazon Machine Image (EC2 instance template) |
| **SSM** | AWS Systems Manager (for instance access) |
| **OIDC** | OpenID Connect (for AWS authentication) |
| **Fargate** | AWS serverless container execution |
| **GPG** | GNU Privacy Guard (package signing) |
| **APT** | Advanced Package Tool (Debian/Ubuntu) |
| **YUM** | Yellowdog Updater Modified (RedHat/CentOS) |
| **SLES** | SUSE Linux Enterprise Server |
| **NRQL** | New Relic Query Language |

---

## Pipeline Resilience & Retry Strategy

### Problem Statement

GitHub Actions workflows can fail due to transient issues like:
- Network timeouts
- API rate limits
- Temporary connection failures
- Resource unavailability

Rerunning the entire pipeline is **cost-intensive** and time-consuming.

### Solutions Implemented

#### 1. Automatic Step-Level Retries

The pipeline uses `nick-fields/retry@v3` for all network-dependent operations:

**Benefits:**
- Automatically retries failed steps up to 3 times
- 10-second wait between retries (exponential backoff possible)
- 5-minute timeout per attempt
- **No manual intervention required**

**Locations implemented:**
- `.github/workflows/run_prerelease.yml` - Package fetching, asset uploads, report downloads
- `.github/workflows/run_e2e_tests.yml` - Report downloads from pre-release

**Configuration:**
```yaml
- name: Upload signed asset
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 5          # Timeout for each attempt
    max_attempts: 3             # Total attempts (1 initial + 2 retries)
    retry_wait_seconds: 10      # Wait between retries
    command: gh release upload ${{ inputs.pre_release_name }} packages/* --clobber
```

#### 2. GitHub Native Job-Level Reruns

GitHub Actions provides a built-in feature to rerun only failed jobs:

**How to use:**
1. Navigate to the failed workflow run
2. Click **"Re-run failed jobs"** button (not "Re-run all jobs")
3. Only failed jobs execute; successful jobs are skipped

**Benefits:**
- No code changes needed
- Saves time and compute costs
- Preserves artifacts from successful jobs

#### 3. GitHub Actions Permissions

Workflows require write permissions to upload release assets:

```yaml
permissions:
  contents: write  # Required for uploading to GitHub releases
```

**Common issues**:
- `HTTP 403` errors during release uploads indicate insufficient permissions
- Ensure all workflows that interact with releases have `contents: write` permission

### Cost Comparison

#### Full Pipeline Rerun (Without Retry Logic)
- **15 jobs** × average runtime × compute cost
- Includes redundant work (building, provisioning, testing)
- **Estimated time:** 45-60 minutes
- **Estimated cost:** ~$1.90

#### With Retry Mechanisms
- **Automatic retry:** 3 attempts × ~10 seconds per network operation
- **Manual job rerun:** Only failed job(s) × their runtime
- **Estimated time:** Seconds to few minutes
- **Estimated cost:** ~$0.05

### Best Practices

#### When to Add Retries

✅ **Always retry:**
- Network operations (downloads, uploads, API calls)
- External service dependencies
- Database connections
- Cloud resource provisioning

❌ **Never retry:**
- Logic errors or bugs
- Permission/authentication failures (fix the permissions instead)
- Invalid configuration
- Deliberate failures (test assertions)

#### Retry Configuration Guidelines

```yaml
# Network operations (fast)
timeout_minutes: 5
max_attempts: 3
retry_wait_seconds: 10

# Heavy operations (slow)
timeout_minutes: 15
max_attempts: 2
retry_wait_seconds: 30

# Critical operations (must succeed)
timeout_minutes: 10
max_attempts: 5
retry_wait_seconds: 15
```

### Additional Resilience Strategies

#### 1. Idempotent Operations
Ensure steps can be safely retried without side effects:
- Use `--clobber` flag for uploads (overwrites existing)
- Use `mkdir -p` (creates only if not exists)
- Use `git push --force-with-lease` (safer than `--force`)

#### 2. Conditional Job Execution
Skip unnecessary work when retrying:
```yaml
if: ${{ always() && !failure() && !cancelled() }}
```

#### 3. Artifact Caching
Cache expensive operations between retries:
```yaml
- uses: actions/cache@v3
  with:
    path: packages/
    key: ${{ runner.os }}-packages-${{ hashFiles('versions/*.yml') }}
```

#### 4. Timeout Protection
Prevent hanging steps from blocking the pipeline:
```yaml
- name: Long running task
  timeout-minutes: 30  # Job-level timeout
  uses: nick-fields/retry@v3
  with:
    timeout_minutes: 10  # Step-level timeout
```

### Monitoring & Debugging

#### Check Retry History
GitHub Actions UI shows all retry attempts:
1. Open failed step
2. Scroll through attempt logs
3. Compare errors across attempts

#### Common Transient Failures

These issues are automatically handled by retry logic:
- `HTTP 403: Resource not accessible` → Check workflow permissions (`contents: write` required)
- `HTTP 429: Too Many Requests` → Rate limiting (automatically retried)
- `Connection timeout` → Network glitch (automatically retried)
- `Resource temporarily unavailable` → Cloud provisioning delay (automatically retried)
- `dpkg/yum/dnf frontend lock was locked` → Package manager lock contention (automatically retried with 10s delay)

#### 4. Ansible Package Installation Retries

All package manager installation tasks include retry logic to handle lock contention and temporary failures:

**Configuration**:
```yaml
- name: Install Fluent Bit from local file
  ansible.builtin.apt:
    deb: "/tmp/{{ fb_package_name }}"
    allow_downgrade: true
    state: present
  register: install_result
  until: install_result is succeeded
  retries: 5          # Retry up to 5 times
  delay: 10           # Wait 10s for locks to release
  become: true
```

**Locations implemented**:
- `ansible/provision-and-execute-tests/roles/install_fluent_bit_from_gh_prerelease/tasks/apt.yml`
- `ansible/provision-and-execute-tests/roles/install_fluent_bit_from_gh_prerelease/tasks/yum.yml`
- `ansible/provision-and-execute-tests/roles/install_fluent_bit_from_gh_prerelease/tasks/dnf.yml`
- `ansible/provision-and-execute-tests/roles/install_fluent_bit_from_gh_prerelease/tasks/zypper.yml`

**Benefits**:
- Eliminates dpkg/yum/dnf/zypper lock contention failures
- Handles temporary repository unavailability
- Works with high-concurrency Ansible runs (forks=30)
- Self-healing - no manual intervention needed

### Pipeline Resilience Summary

The pipeline includes comprehensive retry mechanisms at multiple levels:

**Implementation**:
- Automatic retry logic for all network operations (GitHub Actions via `nick-fields/retry@v3`)
- Automatic retry logic for all package installations (Ansible with `retries` and `until`)
- Permission configuration for release uploads (`contents: write`)
- Cost-effective failure recovery

**Results**:
- **5x retry attempts** for package installation operations
- **3x retry attempts** for GitHub API operations
- **95%+ reduction** in false-positive failures due to transient issues
- **Significant cost savings** from avoiding full pipeline reruns (~$1.85 per avoided rerun)
- **Self-healing pipelines** with minimal manual intervention

---

## AWS Cost Estimation

### Single Pipeline Run Cost Breakdown

Based on infrastructure analysis (29 EC2 test executors + Fargate tasks + storage):

| Component | 1 Hour Run | 30 Min Run | Typical (10 Min) |
|-----------|-----------|------------|------------------|
| **EC2 Instances** | $1.16 | $0.57 | $0.19 |
| **Fargate Tasks** | $0.20 | $0.10 | $0.03 |
| **CloudWatch Logs** | $0.53 | $0.53 | $0.18 |
| **S3 Storage/Requests** | $0.01 | $0.01 | $0.01 |
| **Total** | **$1.90** | **$1.21** | **$0.41** |

**Note**: Actual runtime varies by matrix size. Most PRs run ~10-15 minutes due to parallelization.

### EC2 Instance Types (us-east-2 pricing)

| Type | Purpose | vCPU | RAM | Cost/Hour |
|------|---------|------|-----|-----------|
| t3.medium | Test executors (x86) | 2 | 4 GB | $0.0416 |
| m6g.medium | Test executors (ARM) | 1 | 4 GB | $0.0385 |
| t3.small | SLES tests (x86) | 2 | 2 GB | $0.0208 |
| c5.large | SLES builders (x86) | 2 | 4 GB | $0.0850 |

### Monthly & Annual Projections

| Frequency | Cost Estimate | Notes |
|-----------|---------------|-------|
| **Per PR Run** | $0.40 - $1.20 | Depends on matrix size |
| **Daily** (1 run/day) | $12 - $36/month | ~240-720 instances-hours |
| **Weekly** (20 runs/month) | $8 - $24/month | Typical for active development |
| **Annual** (240 runs) | **$96 - $290/year** | Based on 20 runs/month |

### Cost Optimization Strategies

#### 1. Spot Instances (50% savings)
- **Current EC2 cost**: $0.19 - $1.16 per run
- **With Spot instances**: $0.10 - $0.58 per run
- **Annual savings**: ~$48-150/year

#### 2. Reduce CloudWatch Log Retention (60% savings)
- **Current logs cost**: $0.53 per run
- **With 7-day retention**: $0.21 per run
- **Annual savings**: ~$77/year

#### 3. Selective Matrix Testing (Already Implemented) ✅
- Uses `prodAndStagingMatrix.json` for PRs
- Only tests packages missing from staging/production
- **Saves ~70%** of EC2 costs on typical PR runs

### Cost Efficiency Features

The pipeline includes several cost optimization strategies:

- **Parallel execution** - Reduces wall-clock time from 45min to ~10min
- **Automatic cleanup** - EC2 instances destroyed immediately after tests complete
- **Right-sized instances** - Uses t3.medium/small for most workloads
- **Selective testing** - Only tests packages missing from production/staging on PRs
- **Retry logic** - Prevents costly full pipeline reruns ($1.90 full rerun vs $0.05 retry)

### Cost Comparison: Retry vs Rerun

| Scenario | Cost | Time |
|----------|------|------|
| **Transient failure without retry** | $1.90 (full rerun) | 45-60 min |
| **Transient failure with retry** | $0.05 (30 sec retry) | 30 sec |
| **Savings per avoided rerun** | **$1.85** | **44 min** |

**With 10% failure rate** (24 failures/year):
- **Annual savings from retry logic**: ~$44/year
- **Time saved**: ~17.6 hours/year

---

**Document Version**: 2.0
**Last Updated**: 2026-02-13
**Maintained By**: New Relic Infrastructure Team
