.DEFAULT_GOAL := provision

.PHONY: checks
checks:
ifndef TERRAFORM_PROJECT
	$(error TERRAFORM_PROJECT is undefined)
endif
ifndef PR_NUMBER
	$(error PR_NUMBER is undefined)
endif

# Creates Terraform backend file pointing to a S3 state file
.PHONY: terraform/backend
terraform/backend: checks
	@if [ ! -d "./${TERRAFORM_PROJECT}" ]; then \
  		echo "Terraform project ${TERRAFORM_PROJECT} does not exist"; \
	fi
	@echo "Creating Terraform state file in ./${TERRAFORM_PROJECT}/terraform.backend.tf from template in ./${TERRAFORM_PROJECT}/terraform.backend.tf.dist"
	@sed "s/PR_NUMBER/${PR_NUMBER}/g" "./${TERRAFORM_PROJECT}/terraform.backend.tf.dist" > "./${TERRAFORM_PROJECT}/terraform.backend.tf"
	cat "./${TERRAFORM_PROJECT}/terraform.backend.tf"

# Terraform-applies
.PHONY: provision
provision: terraform/backend
	@echo "Provisioning TERRAFORM_PROJECT=${TERRAFORM_PROJECT} from PR_NUMBER=${PR_NUMBER}"
#	terraform -chdir=$(TERRAFORM_PROJECT) init -reconfigure && \
#	terraform -chdir=$(TERRAFORM_PROJECT) apply -auto-approve

# Terraform-destroys
.PHONY: clean
clean: terraform/backend
#	terraform -chdir=$(TERRAFORM_PROJECT) init -reconfigure && \
#	terraform -chdir=$(TERRAFORM_PROJECT) destroy -auto-approve &&
	@echo "Removing Terraform backend file $(TERRAFORM_PROJECT)/terraform.backend.tf"
	@rm "$(TERRAFORM_PROJECT)/terraform.backend.tf"
