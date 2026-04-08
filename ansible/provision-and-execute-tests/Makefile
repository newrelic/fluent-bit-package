include ../Ansible.common.mk

# Enable AWS SDK Adaptive Mode to handle SSM Throttling
export AWS_MAX_ATTEMPTS = 10
export AWS_RETRY_MODE = adaptive

.PHONY: prerelease
prerelease: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-windows.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)


.PHONY: prerelease-linux
prerelease-linux: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

# Parallel Linux test targets - provision only (no test execution)
.PHONY: prerelease-linux-provision
prerelease-linux-provision: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))

# Parallel provisioning by OS family
.PHONY: prerelease-linux-provision-apt
prerelease-linux-provision-apt: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*' $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))

.PHONY: prerelease-linux-provision-yum
prerelease-linux-provision-yum: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*' $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))

.PHONY: prerelease-linux-provision-sles
prerelease-linux-provision-sles: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-prerelease.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*' $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))

# Run tests on APT-based distros (debian, ubuntu)
.PHONY: prerelease-linux-test-apt
prerelease-linux-test-apt: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-apt.xml)

# Run tests on YUM-based distros (amazonlinux, centos, rockylinux)
.PHONY: prerelease-linux-test-yum
prerelease-linux-test-yum: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-yum.xml)

# Run tests on SLES distros
.PHONY: prerelease-linux-test-sles
prerelease-linux-test-sles: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-sles.xml)

# Merge all partial test reports into final report (downloads from GitHub release)
# Requires TEST_REPORT_NAME and PRE_RELEASE_NAME environment variables
.PHONY: prerelease-linux-merge-all
prerelease-linux-merge-all: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-partial-results.yml -e combined_test_report_name=$(TEST_REPORT_NAME) -e pre_release_name=$(PRE_RELEASE_NAME)

# Aggregate installation reports into a summary table
.PHONY: prerelease-aggregate-installation-reports
prerelease-aggregate-installation-reports: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-aggregate-installation-reports.yml

.PHONY: prerelease-windows
prerelease-windows: dependencies prepare-inventory
	TEST_REPORT_NAME=$(TEST_REPORT_NAME) ansible-playbook $(ANSIBLE_FOLDER)/playbook-windows.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME)

.PHONY: staging
staging: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-ohai-staging.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

# Staging parallel targets
.PHONY: staging-linux-provision
staging-linux-provision: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-ohai-staging.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY)

.PHONY: staging-linux-provision-apt
staging-linux-provision-apt: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-ohai-staging.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*'

.PHONY: staging-linux-provision-yum
staging-linux-provision-yum: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-ohai-staging.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*'

.PHONY: staging-linux-provision-sles
staging-linux-provision-sles: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-ohai-staging.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*'

.PHONY: staging-linux-test-apt
staging-linux-test-apt: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-apt.xml)

.PHONY: staging-linux-test-yum
staging-linux-test-yum: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-yum.xml)

.PHONY: staging-linux-test-sles
staging-linux-test-sles: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-sles.xml)

.PHONY: staging-linux-merge-all
staging-linux-merge-all: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-partial-results.yml -e combined_test_report_name=$(TEST_REPORT_NAME) -e pre_release_name=$(PRE_RELEASE_NAME)

.PHONY: staging-aggregate-installation-reports
staging-aggregate-installation-reports: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-aggregate-installation-reports.yml

.PHONY: staging-windows
staging-windows: dependencies prepare-inventory
	TEST_REPORT_NAME=$(TEST_REPORT_NAME) ansible-playbook $(ANSIBLE_FOLDER)/playbook-windows.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME)

.PHONY: production
production: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-main.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY)
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY)

# Production parallel targets
.PHONY: production-linux-provision
production-linux-provision: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-main.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY)

.PHONY: production-linux-provision-apt
production-linux-provision-apt: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-main.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*'

.PHONY: production-linux-provision-yum
production-linux-provision-yum: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-main.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*'

.PHONY: production-linux-provision-sles
production-linux-provision-sles: dependencies prepare-inventory
	NRIA_REPO_ENDPOINT="https://nr-downloads-main.s3.amazonaws.com/" ansible-playbook $(ANSIBLE_FOLDER)/playbook-provision-repo.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*'

.PHONY: production-linux-test-apt
production-linux-test-apt: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*debian*,*ubuntu*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-apt.xml)

.PHONY: production-linux-test-yum
production-linux-test-yum: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*amazonlinux*,*centos*,*rockylinux*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-yum.xml)

.PHONY: production-linux-test-sles
production-linux-test-sles: dependencies prepare-inventory
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-run-tests.yml -i $(ANSIBLE_INVENTORY) --limit '*sles*'
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME:.xml=-sles.xml)

.PHONY: production-linux-merge-all
production-linux-merge-all: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-partial-results.yml -e combined_test_report_name=$(TEST_REPORT_NAME) -e pre_release_name=$(PRE_RELEASE_NAME)

.PHONY: production-aggregate-installation-reports
production-aggregate-installation-reports: dependencies
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-aggregate-installation-reports.yml

.PHONY: production-windows
production-windows: dependencies prepare-inventory
	TEST_REPORT_NAME=$(TEST_REPORT_NAME) ansible-playbook $(ANSIBLE_FOLDER)/playbook-windows.yml -i $(ANSIBLE_INVENTORY) $(if $(NR_FB_OUTPUT_PLUGIN_VERSION),-e nr_fb_output_plugin_version=$(NR_FB_OUTPUT_PLUGIN_VERSION)) $(if $(NR_FB_OUTPUT_PLUGIN_TAG),-e plugin_tag=$(NR_FB_OUTPUT_PLUGIN_TAG))
	ansible-playbook $(ANSIBLE_FOLDER)/playbook-merge-results.yml -i $(ANSIBLE_INVENTORY) -e combined_test_report_name=$(TEST_REPORT_NAME)

# Removes "collections" and "roles" folders
.PHONY: clean
clean:
	rm -rf $(ROLES_PATH) $(COLLECTIONS_PATH)