# Creates required folder structure, installs dependencies and sets the following environment variables for the calling project:
# - ANSIBLE_FOLDER
# - ANSIBLE_INVENTORY
# - REQUIREMENTS_FILE
# - ROLES_PATH
# - COLLECTIONS_PATH

ANSIBLE_FOLDER := $(CURDIR)
ANSIBLE_INVENTORY_TEMPLATE := $(ANSIBLE_FOLDER)/aws_ec2.yml.dist
ANSIBLE_INVENTORY := $(ANSIBLE_FOLDER)/aws_ec2.yml
export REQUIREMENTS_FILE ?= $(ANSIBLE_FOLDER)/requirements.yml
export ROLES_PATH:=$(ANSIBLE_FOLDER)/roles
export COLLECTIONS_PATH:=$(ANSIBLE_FOLDER)/collections
export CROWDSTRIKE_ROLE_PULL_KEY := $(HOME)/.ssh/crowdstrike_ansible_role_key

# Creates "collections" and "roles" folders inside the calling Ansible project
$(ROLES_PATH) $(COLLECTIONS_PATH):
	@mkdir -p $@

# Installs dependencies into "collections" and "roles" folders
.PHONY: run_ansible_role_key
run_ansible_role_key: ANSIBLE_FOLDER=$(ANSIBLE_FOLDER) ANSIBLE_ENV_SCRIPT=$(ANSIBLE_FOLDER)/set_ansible_env.sh
    
.PHONY: dependencies
dependencies: $(ROLES_PATH) $(COLLECTIONS_PATH)
ifdef ANSIBLE_ENV_SCRIPT
	sh $(ANSIBLE_ENV_SCRIPT)
else
	ansible-galaxy role install -r $(REQUIREMENTS_FILE) -p $(ROLES_PATH)
	ansible-galaxy collection install -r $(REQUIREMENTS_FILE) -p $(COLLECTIONS_PATH)
endif
.PHONY: prepare-inventory
prepare-inventory:
	@sed "s/PRE_RELEASE_NAME/${PRE_RELEASE_NAME}/g" $(ANSIBLE_INVENTORY_TEMPLATE) > $(ANSIBLE_INVENTORY)
