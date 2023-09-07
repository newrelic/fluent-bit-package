.DEFAULT_GOAL := provision

.PHONY: checks
checks:
ifndef TERRAFORM_PROJECT
	$(error TERRAFORM_PROJECT is undefined)
endif
ifndef PR_NUMBER
	$(error PR_NUMBER is undefined)
endif

.PHONY: generateMatrices
generateMatrices:
	$(MAKE) -C ../versions generateMatrices

# Creates Terraform backend file pointing to a S3 state file
.PHONY: terraform/backend
terraform/backend: checks
	@if [ ! -d "./${TERRAFORM_PROJECT}" ]; then \
  		echo "Terraform project ${TERRAFORM_PROJECT} does not exist"; \
	fi
	@echo "Creating Terraform backend file in ./${TERRAFORM_PROJECT}/terraform.backend.tf from template in ./${TERRAFORM_PROJECT}/terraform.backend.tf.dist"
	@sed "s/PR_NUMBER/${PR_NUMBER}/g" "./${TERRAFORM_PROJECT}/terraform.backend.tf.dist" > "./${TERRAFORM_PROJECT}/terraform.backend.tf"

# Exports environment variables that are accessed by the launched Terraform project
.PHONY: terraform/vars
terraform/vars:
	echo "pr_number = \"${PR_NUMBER}\"" >> "./${TERRAFORM_PROJECT}/variables.tfvars"

# Terraform-applies
.PHONY: provision
provision: terraform/backend terraform/vars generateMatrices
	@echo "Provisioning TERRAFORM_PROJECT=${TERRAFORM_PROJECT} from PR_NUMBER=${PR_NUMBER}"
	terraform -chdir=$(TERRAFORM_PROJECT) init -reconfigure && \
	terraform -chdir=$(TERRAFORM_PROJECT) apply -auto-approve -var-file="variables.tfvars"
	# terraform -chdir=$(TERRAFORM_PROJECT) plan -var-file="variables.tfvars"

# Terraform-destroys
.PHONY: clean
clean: terraform/backend terraform/vars generateMatrices
	terraform -chdir=$(TERRAFORM_PROJECT) init -reconfigure && \
	terraform -chdir=$(TERRAFORM_PROJECT) destroy -auto-approve -var-file="variables.tfvars"
	@echo "Removing Terraform backend file $(TERRAFORM_PROJECT)/terraform.backend.tf"
	@rm "$(TERRAFORM_PROJECT)/terraform.backend.tf"
