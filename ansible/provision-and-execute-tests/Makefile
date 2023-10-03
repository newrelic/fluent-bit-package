include ../Ansible.common.mk

.DEFAULT_GOAL := provision-and-execute-tests

.PHONY: provision-and-execute-tests
provision-and-execute-tests: ansible/dependencies ansible/prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)

.PHONY: clean
clean: ansible/clean