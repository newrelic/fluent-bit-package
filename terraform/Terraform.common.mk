.PHONY: checks
checks:
ifndef PRE_RELEASE_NAME
	$(error PRE_RELEASE_NAME is undefined)
endif

TERRAFORM_PROJECT := $(CURDIR)

.PHONY: generateMatrices
generateMatrices:
	$(MAKE) -C ../../versions generateMatrices

# Creates Terraform backend file pointing to a S3 state file
.PHONY: backend
backend: checks
	@echo "Creating Terraform backend file in ./terraform.backend.tf from template in ./terraform.backend.tf.dist"
	@sed "s/PRE_RELEASE_NAME/${PRE_RELEASE_NAME}/g" "./terraform.backend.tf.dist" > "./terraform.backend.tf"

# Exports environment variables that are accessed by the launched Terraform project
.PHONY: vars
vars:
	echo "pre_release_name = \"${PRE_RELEASE_NAME}\"" >> "./variables.tfvars"
