##########################################
# 		     Dynamic targets 			 #
##########################################
# Exclude current and hidden directories
FIND_PATH = . -mindepth 2 -not -path '*/\.*'
# Define the list of subdirectories that contain a Makefile
SUBDIRS := $(patsubst ./%/Makefile,%,$(shell find $(FIND_PATH) -name Makefile))
TARGETS := $(SUBDIRS)

.PHONY: all $(TARGETS) clean $(addsuffix -clean,$(TARGETS)) help local

$(TARGETS):
	$(MAKE) -C $@

clean: $(addsuffix -clean,$(SUBDIRS))

$(addsuffix -clean,$(TARGETS)):
	$(MAKE) -C $(patsubst %-clean,%,$@) clean

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
		$(target) PR_NUMBER=local-$(USER)

help:
	@echo "## Available targets:"
	@echo $(TARGETS)
	@echo "## Available clean targets:"
	@echo $(addsuffix -clean,$(TARGETS))