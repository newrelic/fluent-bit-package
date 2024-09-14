# Terraform-stop
.PHONY: stop
stop: 
	terraform init -reconfigure 
	terraform refresh 
	terraform output -json instance_ids | jq -r '.[]' | paste -sd ' ' - 
	terraform apply -target null_resource.stop_instances -auto-approve 
	@echo "Stopping all the instances"
