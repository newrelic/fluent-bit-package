include ../Ansible.common.mk

.PHONY: run
run: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)
	@sed "s/PRE_RELEASE_NAME/${PRE_RELEASE_NAME}/g" playbook-localhost.yml.dist > playbook-localhost.yml
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-localhost.yml

# Removes "collections" and "roles" folders
.PHONY: clean
clean:
	rm -rf $(ROLES_PATH) $(COLLECTIONS_PATH)
