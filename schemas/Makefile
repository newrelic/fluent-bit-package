# Repository folder inside the bucket for each environment (infrastructure_agent | infrastructure_agent_v2)
STAGING_REPO_PATH ?= infrastructure_agent
PRODUCTION_REPO_PATH ?= infrastructure_agent

.PHONY: generateSchemas
generateSchemas:
	NRIA_ENV="staging" REPO_PATH="$(STAGING_REPO_PATH)" python3 schema.linux.py > generated-linux-schema-staging.yaml
	NRIA_ENV="production" REPO_PATH="$(PRODUCTION_REPO_PATH)" python3 schema.linux.py > generated-linux-schema-production.yaml
