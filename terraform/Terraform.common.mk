.DEFAULT_GOAL := provision

.PHONY: checks
checks:
ifndef PR_NUMBER
	$(error PR_NUMBER is undefined)
endif

TERRAFORM_PROJECT := $(CURDIR)

.PHONY: generateMatrices
generateMatrices:
	$(MAKE) -C ../../versions generateMatrices

# Creates Terraform backend file pointing to a S3 state file
.PHONY: terraform/backend
terraform/backend: checks
	@echo "Creating Terraform backend file in ./terraform.backend.tf from template in ./terraform.backend.tf.dist"
	@sed "s/PR_NUMBER/${PR_NUMBER}/g" "./terraform.backend.tf.dist" > "./terraform.backend.tf"

# Exports environment variables that are accessed by the launched Terraform project
.PHONY: terraform/vars
terraform/vars:
	echo "pr_number = \"${PR_NUMBER}\"" >> "./variables.tfvars"

# Terraform-applies
.PHONY: provision
provision: terraform/backend terraform/vars generateMatrices
	@echo "Provisioning ${TERRAFORM_PROJECT} from PR_NUMBER=${PR_NUMBER}"
	terraform init -reconfigure && \
	terraform apply -auto-approve -var-file="variables.tfvars"
	# terraform plan -var-file="variables.tfvars"

# Terraform-destroys
.PHONY: clean
clean: terraform/backend terraform/vars generateMatrices
	terraform init -reconfigure && \
	terraform destroy -auto-approve -var-file="variables.tfvars"
	@echo "Removing Terraform backend file {$TERRAFORM_PROJECT}/terraform.backend.tf"
	@rm "./terraform.backend.tf"
