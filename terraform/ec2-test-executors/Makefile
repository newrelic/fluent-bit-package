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
	terraform init -reconfigure && \
	terraform apply -auto-approve -var-file="variables.tfvars" && \
	terraform refresh
	aws ec2 stop-instances --region us-east-2 --instance-ids $(terraform output -json instance_ids | jq -r '.[]' | paste -sd ' ' -) ;
	@echo "EC2 instances stopped."