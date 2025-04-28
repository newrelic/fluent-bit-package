.PHONY: generateMatrices
generateMatrices:
	@echo "Installing Python dependencies..."
	pip3 install -r requirements.txt

	@echo "Generating strategy matrix..."
	python3 strategyMatrix.py > strategyMatrix.json

	@echo "Printing jq version..."
	jq --version

	@echo "Validating strategyMatrix.json..."
	python3 -c "import json; json.load(open('strategyMatrix.json'))" || { echo 'Invalid JSON in strategyMatrix.json'; exit 1; }

	@echo "Pretty Printing strategyMatrix.json..."
	jq '.' strategyMatrix.json

	@echo "Work only with missing packages either in prod or staging..."
	cat strategyMatrix.json | jq 'map(select(.isProduction == false or .isStaging == false))' -c > prodAndStagingMatrix.json

	@echo "Generating SLES matrix..."
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro == "sles"))' -c > slesMatrix.json

	@echo "Generating Linux and Windows matrix..."
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro != "sles"))' -c > linuxAndWindowsMatrix.json

	@echo "Generating Windows matrix..."
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro == "windows-server"))' -c > windowsMatrix.json


	# used to generate proper schemas in schema.linux.py
	@echo "Generating staging matrix..."
	cat strategyMatrix.json | jq 'map(select(.isStaging == false))' -c > stagingMatrix.json

	@echo "Generating production matrix..."
	cat strategyMatrix.json | jq 'map(select(.isProduction == false))' -c > productionMatrix.json
