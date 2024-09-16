include ../Terraform.common.mk

# Terraform-applies
.PHONY: prerelease
prerelease: backend vars generateMatrices
	@echo "Provisioning prerelease instances for PRE_RELEASE_NAME=${PRE_RELEASE_NAME}"
	echo "matrix = \"prerelease\"" >> "./variables.tfvars"
	terraform init -reconfigure && \
	terraform apply -auto-approve -var-file="variables.tfvars"

# Terraform-applies
.PHONY: all
all: backend vars generateMatrices
	@echo "Provisioning ALL for PRE_RELEASE_NAME=${PRE_RELEASE_NAME}"
	echo "matrix = \"all\"" >> "./variables.tfvars"
	terraform init -reconfigure && \
	terraform apply -auto-approve -var-file="variables.tfvars"

.PHONY: staging
staging: all

.PHONY: production
production: all

# Terraform-destroys
.PHONY: clean
clean: backend vars generateMatrices
	terraform init -reconfigure && \
	terraform destroy -auto-approve -var-file="variables.tfvars"
	@echo "Removing Terraform backend file ${TERRAFORM_PROJECT}/terraform.backend.tf"
	@rm "./terraform.backend.tf"
	
# Terraform-stop
.PHONY: stop
stop: backend vars generateMatrices
	@echo "Stopping instances for ${TERRAFORM_PROJECT}"
	@instance_ids=$(shell aws ec2 describe-instances --filters "Name=tag:product,Values=logging" --query "Reservations[*].Instances[?State.Name=='running'].InstanceId" --output text) && \
	echo "Found instance IDs: $$instance_ids" && \
	if [ -n "$$instance_ids" ]; then \
		echo "Stopping instances: $$instance_ids"; \
		aws ec2 stop-instances --instance-ids $$instance_ids; \
	else \
		echo "No running instances found to stop."; \
	fi