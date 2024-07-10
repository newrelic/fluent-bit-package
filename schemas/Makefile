.PHONY: generateSchemas
generateSchemas:
	FORMAT="yaml" NRIA_ENV="staging" python3 schema.linux.py > generated-linux-schema-staging.yaml
	FORMAT="yaml" NRIA_ENV="production" python3 schema.linux.py > generated-linux-schema-production.yaml
	FORMAT="json" NRIA_ENV="staging" python3 schema.linux.py > generated-linux-schema-staging.json
	FORMAT="json" NRIA_ENV="production" python3 schema.linux.py > generated-linux-schema-production.json
