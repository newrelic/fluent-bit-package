# Creates required folder structure, installs dependencies and sets the following environment variables for the calling project:
# - ANSIBLE_FOLDER
# - ANSIBLE_INVENTORY
# - REQUIREMENTS_FILE
# - ROLES_PATH
# - COLLECTIONS_PATH

ANSIBLE_FOLDER := $(CURDIR)
ANSIBLE_INVENTORY_TEMPLATE := $(ANSIBLE_FOLDER)/aws_ec2.yml.dist
ANSIBLE_INVENTORY := $(ANSIBLE_FOLDER)/aws_ec2.yml
REQUIREMENTS_FILE := $(ANSIBLE_FOLDER)/requirements.yml
ROLES_PATH := $(ANSIBLE_FOLDER)/roles
COLLECTIONS_PATH := $(ANSIBLE_FOLDER)/collections

# Creates "collections" and "roles" folders inside the calling Ansible project
$(ROLES_PATH) $(COLLECTIONS_PATH):
	@mkdir -p $@

.PHONY: ansible/prepare-inventory
ansible/prepare-inventory:
	@sed "s/PR_NUMBER/${PR_NUMBER}/g" $(ANSIBLE_INVENTORY_TEMPLATE) > $(ANSIBLE_INVENTORY)

# Installs dependencies into "collections" and "roles" folders
.PHONY: ansible/dependencies
ansible/dependencies: $(ROLES_PATH) $(COLLECTIONS_PATH)
	# Requirements to manage EC2 instances using SSM. This should be moved into the fargate-runner-action Dockerfile
	pip3 install boto3
	curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" -o "session-manager-plugin.deb"
	dpkg -i session-manager-plugin.deb

	ansible-galaxy role install -r $(REQUIREMENTS_FILE) -p $(ROLES_PATH)
	ansible-galaxy collection install -r $(REQUIREMENTS_FILE) -p $(COLLECTIONS_PATH)

# Removes "collections" and "roles" folders
.PHONY: ansible/clean
ansible/clean:
	rm -rf $(ROLES_PATH) $(COLLECTIONS_PATH)