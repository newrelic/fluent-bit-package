variable "instance_matrix_file" {
  type = string
  description = "File from where the instance matrix in JSON format will be loaded from."
}

variable "pr_number" {
  type = string
  description = "Pull request number"
}

variable "instance_type" {
  type = string
  description = "Indicates what the created EC2 instances are for. Examples: 'fluentbit-tester', 'fluentbit-builder'. This is later used by the Ansible dynamic inventory (see ansible/build-fb-suse/aws_ec2.yml.dist) to filter out the instances based on their type."
}

variable "crowdstrike_ccid" {
  type = string
  description = "NR Crowdstrike CCID"
}

variable "crowdstrike_bucket" {
  type = string
  description = "Logging's crowdstrike bucket url"
}
