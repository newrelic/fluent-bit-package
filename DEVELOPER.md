# How to test make targets locally
The "local" make target allows you to test any make target like you were executing it remotely in a Fargate task. Instead,
though, it will execute it in a local Docker container using the same image used by the Fargate task and by mounting this
repository (in its current status, locally) as a volume instead of pulling it from GitHub.

The target will read some of the required credentials from Vault. So, **you need to log in to Vault before using this make target.**

This target accepts a single argument, named "target", which specifies what target needs to be executed inside the container,
as well as its arguments. Note that **the PR_NUMBER environment variable does NOT need to be provided**. Instead, the "local"
make target will set it up for you to the value `local-<YOUR_USERNAME>`.

## Terraform targets
Example usage:
```
make local target="terraform TERRAFORM_PROJECT=ec2-suse-builders"
```

In the above example, this would create the SUSE builder VMs, and the corresponding Terraform state would be stored in
the backend S3 bucket under the key `suse-builders-pr-local-<YOUR_USERNAME>`. To destroy the created resources, you'd need
to then run:
```
make local target="terraform-clean TERRAFORM_PROJECT=ec2-suse-builders"
```

## Ansible targets
Each ansible playbook is contained within a project folder with it's own `Makefile`. This makes it easier to execute, since we just need
to provide the path to that project folder.
### Build fluent-bit SLES
```shell
 make local target="ansible/build-fb-suse"
```
### Provision and execute tests
```shell
 make local target="ansible/provision-and-execute-tests"
```
### Upload windows packages to bucket
```shell
 make local target="ansible/upload-win-packages"
```