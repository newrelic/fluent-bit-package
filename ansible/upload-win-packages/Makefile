include ../Ansible.common.mk

.DEFAULT_GOAL := upload-win-packages

.PHONY: upload-win-packages
upload-win-packages: ansible/dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)

.PHONY: clean
clean: ansible/clean
