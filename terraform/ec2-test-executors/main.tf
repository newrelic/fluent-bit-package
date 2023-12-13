locals {
  all_instances_matrix_path = "../../versions/strategyMatrix.json"
}

module "test-executor-instances" {
  source = "../ec2-instances-creator"

  instance_matrix_file = local.all_instances_matrix_path
  pr_number = var.pr_number
  instance_type = "test-executor"
  crowdstrike_ccid = var.crowdstrike_ccid
  crowdstrike_bucket_url = var.crowdstrike_bucket_url
}