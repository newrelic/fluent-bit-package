const fs = require('fs')
const readYamlFile = require('read-yaml-file')

/*
This file builds the strategy matrix to be used in the pull_request.yml. For each supported package to be built/tested,
it builds a JSON object by merging all the fields in the following order (taking centos_9.yml as an example):

  1. Values in "common.yml".
  2. Values in the root of "centos_9.yml", excluding the "packages" array attribute.
  3. Values in "centos_9.yml" from each element of the "packages" array attribute.

Each of the previous steps can overwrite any attribute defined in the previous level. For example, imagine
the following values:

    ---common.yml
    fbVersion: 2.0.8
    ec2User: ec2-user

    ---centos_9.yml
    osDistro: centos
    osVersion: 9
    ec2User: centos      // Overrides value from "common.yml
    fbVersion: 2.0.7     // Overrides value from "common.yml"
    packages:
      - arch: x86_64
        ami: ami-08c92aec9ccf0e1e9
      - arch: aarch64
        ami: ami-0c92309a18dff3e71
        fbVersion: 2.0.6 // Overrides value from root of "centos_9.yml"

This results in the following JSON objects in the resulting strategy matrix (represented in JSON here):

{
    "fbVersion": "2.0.7",
    "ec2User": "centos",
    "osDistro": "centos",
    "osVersion": 9,
    "arch": "x86_64",
    "ami": "ami-08c92aec9ccf0e1e9",
    "packageUrl": "https://packages.fluentbit.io/centos/9/x86_64/fluent-bit-2.0.7-1.x86_64.rpm",
    "targetPackageName": "fluent-bit-2.0.7-1.centos-9.x86_64.rpm",
    "nrPackageUrl": "https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/yum/el/9/x86_64/fluent-bit-2.0.7-1.centos-9.x86_64.rpm"
  },
  {
    "fbVersion": "2.0.6",
    "ec2User": "centos",
    "osDistro": "centos",
    "osVersion": 9,
    "arch": "aarch64",
    "ami": "ami-0c92309a18dff3e71",
    "packageUrl": "https://packages.fluentbit.io/centos/9/aarch64/fluent-bit-2.0.6-1.aarch64.rpm",
    "targetPackageName": "fluent-bit-2.0.6-1.centos-9.arm64.rpm",
    "nrPackageUrl": "https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/yum/el/9/aarch64/fluent-bit-2.0.6-1.centos-9.arm64.rpm"
  }

This script file takes care of computing the following attributes for each supported package:

    - "packageUrl": Official Fluent Bit package for this distribution in the official Fluent Bit repository.
    - "targetPackageName": File name for the package to be stored in the New Relic Infrastructure Agent repository (Linux
       packages) or Logging S3 bucket (Windows packages)
    - "nrPackageUrl": Re-packaged Fluent Bit package for this distribution in the New Relic Infrastructure Agent repository
       (Linux packages) or Logging S3 bucket (Windows packages)
 */

const DEB_DISTROS = ['debian', 'ubuntu']
const WINDOWS_DISTRO = 'windows-server'

const DEB_PACKAGE_DETAILS = ({osDistro, osVersion, fbVersion, arch}) => ({
    packageUrl: `https://packages.fluentbit.io/${osDistro}/${osVersion}/fluent-bit_${fbVersion}_${arch}.deb`,
    targetPackageName: `fluent-bit_${fbVersion}_${osDistro}-${osVersion}_${arch}.deb`,
    nrPackageUrl: `https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/apt/pool/main/f/fluent-bit/fluent-bit_${fbVersion}_${osDistro}-${osVersion}_${arch}.deb`
})

const RPM_TARGET_ARCH_REMAP = {'aarch64': 'arm64', 'x86_64': 'x86_64'}
const RPM_OS_FAMILY_REMAP = {'amazonlinux': 'amazonlinux', 'centos': 'el'}
const RPM_PACKAGE_DETAILS = ({osDistro, osVersion, fbVersion, arch}) => ({
    packageUrl: `https://packages.fluentbit.io/${osDistro}/${osVersion}/${arch}/fluent-bit-${fbVersion}-1.${arch}.rpm`,
    targetPackageName: `fluent-bit-${fbVersion}-1.${osDistro}-${osVersion}.${RPM_TARGET_ARCH_REMAP[arch]}.rpm`,
    nrPackageUrl: `https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/yum/${RPM_OS_FAMILY_REMAP[osDistro]}/${osVersion}/${arch}/fluent-bit-${fbVersion}-1.${osDistro}-${osVersion}.${RPM_TARGET_ARCH_REMAP[arch]}.rpm`
})

const WINDOWS_TARGET_ARCH_REMAP = {'win32': '386', 'win64': 'amd64'}
const WINDOWS_PACKAGE_DETAILS = ({fbVersion, arch}) => ({
    packageUrl: `http://fluentbit.io/releases/${getMajorMinorVersion(fbVersion)}/fluent-bit-${fbVersion}-${arch}.zip`,
    targetPackageName: `fb-windows-${fbVersion}-${WINDOWS_TARGET_ARCH_REMAP[arch]}.zip`
    // TODO: add URL to Logging's S3 bucket holding Windows packages here
    // nrPackageUrl: 'url'
})

// Returns only the major and minor version of a string. If version is "2.1.7", this returns "2.1"
const getMajorMinorVersion = (version) => (version.split('.').slice(0,2).join('.'))

const addPackageDetails = (packageData) => {
    const { osDistro } = packageData

    let packageDetails
    if (WINDOWS_DISTRO === osDistro) {
        packageDetails = WINDOWS_PACKAGE_DETAILS(packageData)
    }
    else if (DEB_DISTROS.includes(osDistro)) {
        packageDetails = DEB_PACKAGE_DETAILS(packageData)
    }
    else {
        packageDetails = RPM_PACKAGE_DETAILS(packageData)
    }

    return {
        ...packageData,
        ...packageDetails
    }
}

const readDistroPackages = async (distroFile) => {
    const commonData = await readYamlFile('common.yml')
    const { packages, ...commonDistroData} = await readYamlFile(distroFile)

    return packages.map(packageData => ({
        ...commonData,
        ...commonDistroData,
        ...packageData
    }))
}

const listDistroFiles = () => {
    try {
        return fs.readdirSync('.').filter((filename) =>
            (filename.endsWith('.yml') || filename.endsWith('.yaml')) && filename !== 'common.yml'
        );
    } catch (err) {
        console.error('Error while reading distribution package files:', err);
    }
}

const generateMatrix = async () => {
    return (await Promise.all(listDistroFiles().map(readDistroPackages)))
        .flat()
        .map(addPackageDetails)
}

(async () => {
    const matrix = await generateMatrix()
    console.log(JSON.stringify(matrix))
})();



