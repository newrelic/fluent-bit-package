include ../Ansible.common.mk

.DEFAULT_GOAL := provision-and-execute-tests

.PHONY: provision-and-execute-tests
provision-and-execute-tests: ansible/dependencies ansible/prepare-inventory
ifeq ($(NRIA_ENV),prerelease)
	@echo "Running commands for prerelease"
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-prerelease.yml -i $(ANSIBLE_INVENTORY)
	TEST_REPORT_FILENAME="test-report-$(NRIA_ENV).xml" ansible-playbook $(ANSIBLE_FOLDER)/playbook-localhost.yml -i $(ANSIBLE_INVENTORY)
else ifneq (,$(findstring $(NRIA_ENV),staging production))
	@echo "Running commands for either staging or production"
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-nr-repo.yml -i $(ANSIBLE_INVENTORY)
	TEST_REPORT_FILENAME="test-report-$(NRIA_ENV).xml" ansible-playbook $(ANSIBLE_FOLDER)/playbook-localhost.yml -i $(ANSIBLE_INVENTORY)
endif

.PHONY: clean
clean: ansible/clean