variable "pre_release_name" {
  type = string
  description = "Pull request's release name"
}

variable "matrix" {
  type        = string
  description = "Two values; prerelease or all. Prerelease will spin up instances for which we are processing packages. All will spin up all supported instances."
  default     = "prerelease"
}

variable "instance_count" {
  default = 1
}