variable "pr_number" {
  type = string
  description = "Pull request number"
}

variable "NRIA_ENV" {
  type        = string
  description = "Where to download NRIA from; staging or production. This changes the instances to be tested"
  default     = "prerelease"
}
