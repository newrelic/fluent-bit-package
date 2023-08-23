.DEFAULT_GOAL := generateMatrices

.PHONY: generateMatrices
generateMatrices:
	pip3 install -r requirements.txt
	python3 strategyMatrix.py > strategyMatrix.json
	cat strategyMatrix.json | jq 'map(select(.osDistro != "windows-server"))' -c > linuxMatrix.json
	cat strategyMatrix.json | jq 'map(select(.osDistro == "windows-server"))' -c > windowsMatrix.json
