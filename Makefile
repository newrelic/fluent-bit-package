# Root Makefile

# Find all subdirectory Makefiles
MAKEFILES := $(shell find . -name Makefile -not -path "./Makefile")

# Function to extract targets from a Makefile
define get_targets
$(shell grep '^[^(#|.|$)[:space:]].*:' $(1) | grep -v '=' | cut -d ':' -f 1)
endef

# Function to create a target string for each target in a sub-Makefile
define create_target
$(foreach target,$(call get_targets,$(1)),$(patsubst %/Makefile,%,$(dir $(1)))$(target))
endef

# Collect all targets from all sub-Makefiles
SUBDIR_TARGETS := $(foreach mkfile,$(MAKEFILES),$(call create_target,$(mkfile)))

# Define the targets
$(SUBDIR_TARGETS):
	$(MAKE) -C $(dir $@) $(notdir $@)

local:
	docker run -it --platform=linux/amd64 \
        -v $(shell pwd)/tools/local_testing_entrypoint.sh:/entrypoint.sh \
		-v $(shell pwd):/srv/fluent-bit-package \
		-v /tmp/test-reports:/tmp/test-reports \
		-e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} \
		-e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
		-e AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN} \
		-e AWS_DEFAULT_REGION=us-east-2 \
		-e NEW_RELIC_API_KEY=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_API_KEY) \
		-e NEW_RELIC_ACCOUNT_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_ACCOUNT_ID) \
		-e NEW_RELIC_REGION=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_REGION) \
		-e CROWDSTRIKE_CLIENT_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CLIENT_ID) \
		-e CROWDSTRIKE_CLIENT_SECRET=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CLIENT_SECRET) \
		-e CROWDSTRIKE_CUSTOMER_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CUSTOMER_ID) \
		ghcr.io/newrelic/fargate-runner-action:latest \
		$(target) PRE_RELEASE_NAME=local-$(USER)

help:
	@echo "## Available targets:"
	@echo $(SUBDIR_TARGETS)