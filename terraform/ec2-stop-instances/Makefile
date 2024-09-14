# Terraform-stop
.PHONY: stop
stop: 
	terraform init -reconfigure && \
	terraform refresh && \
	terraform apply -target null_resource.stop_instances -auto-approve 
	@echo "Stopping all the instances"
