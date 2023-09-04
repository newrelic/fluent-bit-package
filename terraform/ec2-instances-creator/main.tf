locals {
  # Available fields in each element:
  #  {
  #    "fbVersion": "2.0.7",
  #    "osDistro": "centos",
  #    "osVersion": 9,
  #    "arch": "x86_64",
  #    "ami": "ami-08c92aec9ccf0e1e9",
  #    ...
  #  }
  instance_matrix = jsondecode(file(var.instance_matrix_file))

  aws_vpc_subnet = "subnet-06240c469195932cf"
  ec2_instances_security_group = "sg-0c4318be91bbe3cba"
  ec2_instance_profile = "logging-e2e-testing-ec2-ssm-instance-profile"

  # See: https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent-status-and-restart.html
  # TODO Verify for Ubuntu: it seems Ubuntu >18 uses snap, but verify if systemctl also starts SSM agent correctly
  linux_user_data_boot_script_for_ssm = <<EOF
#!/bin/bash
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
EOF
  # TODO Test
  windows_data_boot_script_for_ssm = <<EOF
Start-Service AmazonSSMAgent
EOF

  # Default tags applied to all created resources
  default_tags = {
    product = "logging"
    owning_team = "logging"
    project = "fluent-bit-packaging-and-testing"
  }
}

module "ec2_instance" {
  source  = "terraform-aws-modules/ec2-instance/aws"

  for_each = { for pkg in local.instance_matrix : "pr-${var.pr_number}-${pkg.osDistro}-${pkg.osVersion}-${pkg.arch}-fb-${pkg.fbVersion}-${var.name_suffix}" => pkg }

  name = each.key

  ami                    = each.value.ami
  instance_type          = "t3.small"
  vpc_security_group_ids = [local.ec2_instances_security_group]
  subnet_id              = local.aws_vpc_subnet

  iam_instance_profile   = local.ec2_instance_profile

  user_data = each.value.osDistro == "windows-server" ? local.windows_data_boot_script_for_ssm : local.linux_user_data_boot_script_for_ssm

  tags = merge(local.default_tags, {
    pr_number = var.pr_number
    os_distro = each.value.osDistro
    os_version = each.value.osVersion
    arch = each.value.arch
    fb_version = each.value.fbVersion
    name_suffix = var.name_suffix
  })
}