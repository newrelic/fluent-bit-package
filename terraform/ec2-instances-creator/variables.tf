variable "instance_matrix_file" {
  type = string
  description = "File from where the instance matrix in JSON format will be loaded from."
}

variable "pr_number" {
  type = string
  description = "Pull request number"
}

variable "name_suffix" {
  type = string
  description = "Name suffix to indicate what the created EC2 instances are for. Examples: 'fluentbit-tester', 'fluentbit-builder'"
}