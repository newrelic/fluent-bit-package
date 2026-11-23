locals {
  # Available fields in each element:
  #  {
  #    "fbVersion": "2.0.7",
  #    "osDistro": "centos",
  #    "osVersion": 9,
  #    "arch": "x86_64",
  #    "ami": "ami-08c92aec9ccf0e1e9",
  #    "targetPackageName": "fluent-bit-2.0.7-1.centos-9.x86_64.rpm",
  #    ...
  #  }
  instance_matrix = jsondecode(file(var.instance_matrix_file))

  aws_vpc_subnet = "subnet-0271924cb6b30c703"
  ec2_instances_security_group = "sg-0e8e90f88828d510d"
  ec2_instance_profile = "logging-e2e-testing-ec2-ssm-instance-profile"

  # See: https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent-status-and-restart.html

  # Amazon Linux, Ubuntu and Windows come with the SSM Agent installed by default and is started on boot automatically.
  # SLES AMIs come with the SSM Agent installed by default but it requires being started on boot.
  # CentOS AMIs do not come with the SSM Agent installed by default: https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-centos-7.html
  # Debian AMIs do not come with the SSM Agent installed by default: https://docs.aws.amazon.com/systems-manager/latest/userguide/agent-install-deb.html
  # The user data script referenced below takes care of installing the SSM Agent and starting it on boot for the aforementioned OSes.
  os_distros_requiring_user_data_script_for_ssm = ["sles", "centos", "debian", "rockylinux"]
  user_data_script_for_ssm_path = "${path.module}/user_data_script_for_ssm.tftpl"

  # Default tags applied to all created resources
  default_tags = {
    product = "logging"
    owning_team = "logging"
    project = "fluent-bit-packaging-and-testing"
  }
}

module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"

  for_each = { for pkg in local.instance_matrix : "${var.pre_release_name}-${pkg.osDistro}-${pkg.osVersion}-${pkg.arch}-fb-${pkg.fbVersion}-${var.instance_type}" => pkg }

  name = each.key

  ami                    = each.value.ami
  # instance_type          = contains(["x86_64", "amd64", "win64", "win32"], each.value.arch) ? "t3.small" : "t4g.small"
  vpc_security_group_ids = [local.ec2_instances_security_group]
  subnet_id              = local.aws_vpc_subnet
  create_security_group  = false

  iam_instance_profile   = local.ec2_instance_profile

  # -----------------------------------------------------------------------
  # OPTIMIZED INSTANCE SIZING
  # -----------------------------------------------------------------------
  # Logic:
  # 1. Builders: Upgrade to Compute Optimized (c5/c6g) to prevent CPU throttling.
  # 2. Testers:  Default to t3.medium/t4g.medium (4GB RAM) for stability (fixes Node.js flakiness).
  #              EXCEPTION: SLES must use t3.small/t4g.small due to AWS Marketplace AMI restrictions.
  #
  # Architecture Mapping:
  # | Role      | Arch             | Instance Type |
  # |-----------|------------------|---------------|
  # | Builder   | x86_64 / amd64   | c5.large      |
  # | Builder   | arm64 / aarch64  | c6g.large     |
  # | Tester    | x86_64 / amd64   | t3.medium* |
  # | Tester    | arm64 / aarch64  | t4g.medium* |
  # *SLES Testers fallback to t3.small/t4g.small
  # -----------------------------------------------------------------------
  instance_type = (
    # 1. Builders (High Performance)
    var.instance_type == "fluentbit-builder" ? (
      contains(["x86_64", "amd64"], each.value.arch) ? "c5.large" : "c6g.large"
    ) :

    # 2. SLES Exception (Marketplace Restriction)
    # Must explicitly force SLES to small because its AMI blocks t3.medium
    length(regexall("(?i)sles", each.value.osDistro)) > 0 ? (
      contains(["x86_64", "amd64"], each.value.arch) ? "t3.small" : "t4g.small"
    ) :

    # 3. Default Testers (Windows, Ubuntu, Debian, CentOS, AmazonLinux)
    # All these distros benefit from 4GB RAM (medium) to prevent flaky tests.
    # 'm6g' provides consistent CPU (non-burstable) to prevent SSM timeouts during heavy loads.
    (
      contains(["x86_64", "amd64", "win64", "win32"], each.value.arch) ? "t3.medium" : "m6g.medium"
    )
  )

  # Ubuntu 26.04 (resolute) needs this user_data too: it ships sudo-rs, whose use_pty
  # default breaks Ansible `become` over the SSM connection (details in the .tftpl).
  # All other distros/versions are unchanged.
  user_data = (contains(local.os_distros_requiring_user_data_script_for_ssm, each.value.osDistro) || (each.value.osDistro == "ubuntu" && each.value.osVersion == "resolute")) ? templatefile(local.user_data_script_for_ssm_path, { os_distro = each.value.osDistro, arch = each.value.arch, os_version = each.value.osVersion }) : null

  # Include fields from the strategy matrix into the EC2 instance tags. Thanks to this, we are able to know which Fluent
  # Bit version and for which OS version and arch is each EC2 instance meant to compile/test. This is later read in the
  # Ansible playbooks as variables.
  tags = merge(local.default_tags, {
    pre_release_name = var.pre_release_name
    os_distro = each.value.osDistro
    os_version = each.value.osVersion
    arch = each.value.arch
    fb_version = each.value.fbVersion
    instance_type = var.instance_type
    fb_package_name = each.value.targetPackageName
  })

  volume_tags = merge(local.default_tags, {
    pre_release_name = var.pre_release_name
    os_distro = each.value.osDistro
    os_version = each.value.osVersion
    arch = each.value.arch
    fb_version = each.value.fbVersion
    instance_type = var.instance_type
    fb_package_name = each.value.targetPackageName
  })
}