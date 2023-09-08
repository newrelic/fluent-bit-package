locals {
  suse_matrix_path = "../../versions/slesMatrix.json"
}


module "suse-fb-builder-instances" {
  source = "../ec2-instances-creator"

  instance_matrix_file = local.suse_matrix_path
  pr_number = var.pr_number
  instance_type = "fluentbit-builder"
}