include ../Ansible.common.mk

.DEFAULT_GOAL := upload-win-packages

.PHONY: generateMatrix
generateMatrix:
	$(MAKE) -C ../../versions generateMatrices
	$(mv) windowsMatrix.json $(ANSIBLE_FOLDER)/

.PHONY: upload-win-packages
upload-win-packages: ansible/dependencies generateMatrix
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)

.PHONY: clean
clean: ansible/clean
