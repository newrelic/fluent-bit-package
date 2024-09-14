# creates a resource named null_resource 
resource "null_resource" "stop_instances" {
  provisioner "local-exec" {
    on_failure  = continue
    command     = <<EOT
         aws ec2 stop-instances --region us-east-2  --instance-ids $(terraform output -json instance_ids | jq -r '.[]' | paste -sd ' ' -)       
     EOT
  }
}