locals {
  all_instances_matrix_path = "../../versions/strategyMatrix.json"
  built_packages_instance_matrix_path = "../../versions/prodAndStagingMatrix.json"
  to_use_matrix = var.NRIA_ENV == "prerelease" ? local.built_packages_instance_matrix_path : local.all_instances_matrix_path
}

module "test-executor-instances" {
  source = "../ec2-instances-creator"

  instance_matrix_file = local.to_use_matrix
  pr_number = var.pr_number
  instance_type = "test-executor"
}