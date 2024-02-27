.PHONY: generateSchemas
generateSchemas:
	NRIA_ENV="staging" python3 schema.linux.py > generated-linux-schema-staging.yaml
	NRIA_ENV="production" python3 schema.linux.py > generated-linux-schema-production.yaml
