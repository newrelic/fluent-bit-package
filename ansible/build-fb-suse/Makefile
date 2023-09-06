include ../Ansible.common.mk

.DEFAULT_GOAL := build-fb-suse

.PHONY: build-fb-suse
build-fb-suse: ansible/dependencies ansible/prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY) -vvv

.PHONY: clean
clean: ansible/clean