include ../Ansible.common.mk

.DEFAULT_GOAL := build-fb-suse

.PHONY: build-fb-suse
build-fb-suse: ansible/dependencies ansible/prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)
	@sed "s/PR_NUMBER/${PR_NUMBER}/g" playbook-localhost.yml.dist > playbook-localhost.yml
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-localhost.yml

.PHONY: clean
clean: ansible/clean