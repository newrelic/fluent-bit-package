variable "pr_number" {
  type = string
  description = "Pull request number"
}

variable "crowdstrike_ccid" {
  type = string
  description = "NR Crowdstrike CCID"
}

variable "crowdstrike_bucket" {
  type = string
  description = "Logging's crowdstrike bucket url"
}
