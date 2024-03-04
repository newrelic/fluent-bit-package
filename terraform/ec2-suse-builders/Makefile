include ../Terraform.common.mk

# Terraform-applies
.PHONY: provision
provision: backend vars generateMatrices
	@echo "Provisioning ${TERRAFORM_PROJECT} from PRE_RELEASE_NAME=${PRE_RELEASE_NAME}"
	terraform init -reconfigure && \
	terraform apply -auto-approve -var-file="variables.tfvars"

# Terraform-destroys
.PHONY: clean
clean: backend vars generateMatrices
	terraform init -reconfigure && \
	terraform destroy -auto-approve -var-file="variables.tfvars"
	@echo "Removing Terraform backend file ${TERRAFORM_PROJECT}/terraform.backend.tf"
	@rm "./terraform.backend.tf"
