# How are make targets generated
Every sub-projects must provide with a `Makefile` that contains any targets. Currently we have;
- `ansible/build-fb-suse/Makefile`
- `ansible/provision-and-execute-tests/Makefile`
- `ansible/upload-win-packages/Makefile`
- `terraform/ec2-suse-builders/Makefile`
- `terraform/ec2-test-executors/Makefile`
- `versions/Makefile`
- `schemas/Makefile`

When `make` is invoked in the root directory, it will look for all `Makefile`s present in the sub-projects, scan their
targets and populate them in the root `Makefile`. As an example, all targets from `ansible/build-fb-suse/Makefile` will
be available in the root `Makefile` as;

- `ansible/build-fb-suse/run`
- `ansible/build-fb-suse/clean`

> CAUTION  
> Targets included in `Ansible.common.mk` or `Terraform.common.mk` are not included in the root `Makefile`.
> This happens because **the root `Makefile` can only identify targets that are present in the sub-projects `Makefile`s**
> , and not in any referenced files (like `Ansible.common.mk` or `Terraform.common.mk`).

# How to test make targets locally
The "local" make target allows you to test any make target like you were executing it remotely in a Fargate task. Instead,
though, it will execute it in a local Docker container using the same image used by the Fargate task and by mounting this
repository (in its current status, locally) as a volume instead of pulling it from GitHub.

The target will read some of the required credentials from Vault. So, **you need to log in to Vault before using this make target.**

This target accepts a single argument, named "target", which specifies what target needs to be executed inside the container,
as well as its arguments. Note that **the PRE_RELEASE_NAME environment variable does NOT need to be provided**. Instead, the "local"
make target will set it up for you to the value `local-<YOUR_USERNAME>`.

## Terraform targets
### EC2 SUSE builders
The following command would create the SUSE builder VMs, and the corresponding Terraform state would be stored in
the backend S3 bucket under the key `"suse-builders-local-<YOUR_USERNAME>`.
```shell
make local target="terraform/ec2-suse-builders/provision"
````
To destroy the created resources, you'd need to then run:
```shell
make local target="terraform/ec2-suse-builders/clean "
```

### EC2 Test executors
Spin up an ec2 instances for only the packages for which the used fb version does not exist in either staging nor production:
```shell
make local target="terraform/ec2-test-executors/prerelease"
```
Spin up an ec2 instance for each supported package (every yml file in `versions/`):
```shell
make local target="terraform/ec2-test-executors/all"
```
Note that there is only one target to destroy the resources, since the `clean` target will destroy all the resources created by either
`prerelease` or `all` targets.
```shell
make local target="ansible/provision-and-execute-tests/clean"
```

## Ansible targets
Each ansible playbook is contained within a project folder with it's own `Makefile`. This makes it easier to execute, since we just need
to provide the path to that project folder and the target we'd like to execute.
Once ec2 instances are up, tagged and running, we can run ansible playbooks on them.
### Build fluent-bit SLES
```shell
 make local target="ansible/build-fb-suse/run"
```
### Provision and execute tests
#### Prerelease
If we spun up instances to test only prerelease packages, we can then run tests on them. Here we select the 
`prerelease` target since this will run the playbook to install NRIA from production bucket AND install fluent-bit
from the pre_release.
```shell
 make local target="ansible/provision-and-execute-tests/prerelease"
```
#### Production and Staging
Now, when packages are available in either production or staging, we can then run tests on NRIA installed from either
of this repositories(buckets). This means the NRIA will pull the latest fluent-bit package from the selected bucket.
This way we can, after testing the package from the pre_release, publish it to staging and run again the test suite
to make sure everything is working as expected.
##### Production
```shell
 make local target="ansible/provision-and-execute-tests/production"
```
##### Staging
```shell
 make local target="ansible/provision-and-execute-tests/staging"
```
### Upload windows packages to bucket
```shell
 make local target="ansible/upload-win-packages"
```
### Use local ansible roles
If you happen to develop changes in a role used by any ansible playbook, here is an example on
how to do that for `git+https://github.com/Sivakumar3695/caos-ansible-roles#/caos.ansible_roles/`;
1. Clone the repo
```sh
git clone https://github.com/Sivakumar3695/caos-ansible-roles ~/
```
2. Modify the dependency in your playbook's `requirements.txt`, in this case `ansible/provision-and-execute-tests/requirements.yml`;
```yml
  - name: git+file:///caos-ansible-roles/
    type: git
```
3. Mount your local repo in the container's `/caos-ansible-role` volume in `Makefile`;
```makefile
local:
	docker run -it --platform=linux/amd64 \
    -v $(shell pwd)/tools/local_testing_entrypoint.sh:/entrypoint.sh \
		-v $(shell pwd):/srv/fluent-bit-package \
		-v ~/caos-ansible-roles:/caos-ansible-roles \ // <<<<< THIS
		-v /tmp/test-reports:/tmp/test-reports \
		-e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} \
		-e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
		-e AWS_SESSION_TOKEN=${AWS_SESSION_TOKEN} \
		-e AWS_DEFAULT_REGION=us-east-2 \
		-e NEW_RELIC_API_KEY=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_API_KEY) \
		-e NEW_RELIC_ACCOUNT_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_ACCOUNT_ID) \
		-e NEW_RELIC_REGION=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/NEW_RELIC_REGION) \
		-e CROWDSTRIKE_CLIENT_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CLIENT_ID) \
		-e CROWDSTRIKE_CLIENT_SECRET=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CLIENT_SECRET) \
		-e CROWDSTRIKE_CUSTOMER_ID=$(shell newrelic-vault us read -field=value terraform/logging/logging-e2e-testing-infra/CROWDSTRIKE_CUSTOMER_ID) \
		ghcr.io/newrelic/fargate-runner-action:latest \
		$(target) PRE_RELEASE_NAME=local-$(USER)
```
4. Done!
