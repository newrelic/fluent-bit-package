include ../Ansible.common.mk

.PHONY: prerelease
prerelease: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-windows.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

.PHONY: staging
staging: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-staging.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

.PHONY: production
production: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-production.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

# Removes "collections" and "roles" folders
.PHONY: clean
clean:
	rm -rf $(ROLES_PATH) $(COLLECTIONS_PATH)