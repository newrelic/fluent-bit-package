.DEFAULT_GOAL := generateMatrices

.PHONY: generateMatrices
generateMatrices:
	#pip3 install -r requirements.txt
	python3 strategyMatrix.py > strategyMatrix.json
	# work only with missing packages either in prod or staging
	cat strategyMatrix.json | jq 'map(select(.isProd == false or .isStaging == false))' -c > prodAndStagingMatrix.json
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro == "sles"))' -c > slesMatrix.json
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro != "sles"))' -c > linuxAndWindowsMatrix.json
	cat prodAndStagingMatrix.json | jq 'map(select(.osDistro == "windows-server"))' -c > windowsMatrix.json
	# used to generate proper schemas in schema.linux.py
	cat strategyMatrix.json | jq 'map(select(.isStaging == false))' -c > stagingMatrix.json
	cat strategyMatrix.json | jq 'map(select(.isProd == false))' -c > prodMatrix.json
