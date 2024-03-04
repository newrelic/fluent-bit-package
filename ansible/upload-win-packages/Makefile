include ../Ansible.common.mk

.PHONY: generateMatrix
generateMatrix:
	$(MAKE) -C ../../versions generateMatrices

.PHONY: run
run: dependencies generateMatrix
	ansible-playbook $(ANSIBLE_FOLDER)/playbook.yml -i $(ANSIBLE_INVENTORY)

# Removes "collections" and "roles" folders
.PHONY: clean
clean:
	rm -rf $(ROLES_PATH) $(COLLECTIONS_PATH)
