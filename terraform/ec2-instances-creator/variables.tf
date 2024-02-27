variable "instance_matrix_file" {
  type = string
  description = "File from where the instance matrix in JSON format will be loaded from."
}

variable "pre_release_name" {
  type = string
  description = "Pull request's release name"
}

variable "instance_type" {
  type = string
  description = "Indicates what the created EC2 instances are for. Examples: 'fluentbit-tester', 'fluentbit-builder'. This is later used by the Ansible dynamic inventory (see ansible/build-fb-suse/aws_ec2.yml.dist) to filter out the instances based on their type."
}