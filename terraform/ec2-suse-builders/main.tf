locals {
  suse_matrix_path = "../../versions/slesMatrix.json"
}

module "suse-fb-builder-instances" {
  source = "../ec2-instances-creator"

  instance_matrix_file = local.suse_matrix_path
  pre_release_name = var.pre_release_name
  instance_type = "fluentbit-builder"
}