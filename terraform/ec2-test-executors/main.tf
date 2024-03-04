locals {
  # There are two strategy matrices that we use to spin up instances;
  ## strategyMatrix.json
  #  This matrix contains the list of ALL the packages that we support (every os definition in versions/ directory).
  #  We use this matrix to spin up instances for running the e2e USING/INSTALLING THE NRIA+FB DIRECTLY FROM EITHER STAGING
  #  OR PROD REPOS, without overriding fluent-bit.
  all_instances_matrix_path = "../../versions/strategyMatrix.json"
  ## prodAndStagingMatrix.json
  #  This matrix contains ONLY the packages that have been built (aka they were uploaded to the gh pre_release). This
  #  matrix is built checking the packages missing in either the production or staging repos.
  #  We use this matrix to spin up instances that will install NRIA from the production repo AND FB FROM THE PRE_RELEASE.
  built_packages_instance_matrix_path = "../../versions/prodAndStagingMatrix.json"
  to_use_matrix = var.matrix == "prerelease" ? local.built_packages_instance_matrix_path : local.all_instances_matrix_path
}

module "test-executor-instances" {
  source = "../ec2-instances-creator"

  instance_matrix_file = local.to_use_matrix
  pre_release_name = var.pre_release_name
  instance_type = "test-executor"
}