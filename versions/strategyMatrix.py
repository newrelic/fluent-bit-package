import os
import json
import yaml

"""
This file builds the strategy matrix to be used in the pull_request.yml. For each supported package to be built/tested,
it builds a JSON object by merging all the fields in the following order (taking centos_9.yml as an example):

  1. Values in "common.yml".
  2. Values in the root of "centos_9.yml", excluding the "packages" array attribute.
  3. Values in "centos_9.yml" from each element of the "packages" array attribute.

Each of the previous steps can overwrite any attribute defined in the previous level. For example, imagine
the following values:

    ---common.yml
    fbVersion: 2.0.8

    ---centos_9.yml
    osDistro: centos
    osVersion: 9
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
"""

DEB_DISTROS = ['debian', 'ubuntu']
RPM_DISTROS = ['amazonlinux', 'centos']
WINDOWS_DISTRO = 'windows-server'

def deb_package_details(pkg):
    return {
        'packageUrl': f"https://packages.fluentbit.io/{pkg['osDistro']}/{pkg['osVersion']}/fluent-bit_{pkg['fbVersion']}_{pkg['arch']}.deb",
        'targetPackageName': f"fluent-bit_{pkg['fbVersion']}_{pkg['osDistro']}-{pkg['osVersion']}_{pkg['arch']}.deb",
        'nrPackageUrl': 
f"https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/apt/pool/main/f/fluent-bit/fluent-bit_{pkg['fbVersion']}_{pkg['osDistro']}-{pkg['osVersion']}_{pkg['arch']}.deb"
    }

def rpm_package_details(pkg):
    rpm_target_arch_remap = {'aarch64': 'arm64', 'x86_64': 'x86_64'}
    rpm_os_family_remap = {'amazonlinux': 'amazonlinux', 'centos': 'el'}
    return {
        'packageUrl': f"https://packages.fluentbit.io/{pkg['osDistro']}/{pkg['osVersion']}/{pkg['arch']}/fluent-bit-{pkg['fbVersion']}-1.{pkg['arch']}.rpm",
        'targetPackageName': f"fluent-bit-{pkg['fbVersion']}-1.{pkg['osDistro']}-{pkg['osVersion']}.{rpm_target_arch_remap[pkg['arch']]}.rpm",
        'nrPackageUrl': 
f"https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/yum/{rpm_os_family_remap[pkg['osDistro']]}/{pkg['osVersion']}/{pkg['arch']}/fluent-bit-{pkg['fbVersion']}-1.{pkg['osDistro']}-{pkg['osVersion']}.{rpm_target_arch_remap[pkg['arch']]}.rpm"
    }

def sles_package_details(pkg):
    return {
        # SLES packages are not officially available in Fluent Bit repos (we compile them ourselves), so no 'packageUrl' is available for them.
        'targetPackageName': f"fluent-bit-{pkg['fbVersion']}-1.{pkg['osDistro']}{pkg['osVersion']}.{pkg['arch']}.rpm",
        'nrPackageUrl':
            f"https://nr-downloads-main.s3.amazonaws.com/infrastructure_agent/linux/zypp/{pkg['osDistro']}/{pkg['osVersion']}/{pkg['arch']}/fluent-bit-{pkg['fbVersion']}-1.{pkg['osDistro']}{pkg['osVersion']}.{pkg['arch']}.rpm"
    }

def windows_package_details(data):
    windows_target_arch_remap = {'win32': '386', 'win64': 'amd64'}
    return {
        'packageUrl': f"http://fluentbit.io/releases/{get_major_minor_version(data['fbVersion'])}/fluent-bit-{data['fbVersion']}-{data['arch']}.zip",
        'targetPackageName': f"fb-windows-{data['fbVersion']}-{windows_target_arch_remap[data['arch']]}.zip"
        # TODO: add URL to Logging's S3 bucket holding Windows packages here
        # 'nrPackageUrl': 'url'
    }

def get_major_minor_version(version):
    """ Returns only the major and minor version of a string. If version is "2.1.7", this returns "2.1" """
    return '.'.join(version.split('.')[:2])

def add_package_details(package_data):
    os_distro = package_data['osDistro']

    if os_distro == WINDOWS_DISTRO:
        package_details = windows_package_details(package_data)
    elif os_distro in DEB_DISTROS:
        package_details = deb_package_details(package_data)
    elif os_distro in RPM_DISTROS:
        package_details = rpm_package_details(package_data)
    else:
        package_details = sles_package_details(package_data)

    return {**package_data, **package_details}

def read_distro_packages(distro_file):
    with open('common.yml', 'r') as common_file:
        common_data = yaml.safe_load(common_file)

    with open(distro_file, 'r') as distro_file:
        distro_data = yaml.safe_load(distro_file)
        common_distro_data = {key: value for key, value in distro_data.items() if key != 'packages'}

    return [
        {**common_data, **common_distro_data, **package_data}
        for package_data in distro_data['packages']
    ]

def list_distro_files():
    try:
        return [
            filename
            for filename in os.listdir('.')
            if (filename.endswith('.yml') or filename.endswith('.yaml')) and filename != 'common.yml'
        ]
    except Exception as e:
        print(f"Error while reading distribution package files: {e}")
        return []

def generate_matrix():
    return [
        add_package_details(package_data)
        for distro_file in list_distro_files()
        for package_data in read_distro_packages(distro_file)
    ]

if __name__ == "__main__":
    matrix = generate_matrix()
    print(json.dumps(matrix))

