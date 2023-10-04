Role Name
=========

This role uninstalls the existing Fluent Bit package and re-installs by grabbing it from the specified GH prerelease. It
also takes care of restarting the Infra-Agent to ensure that it picks up the new Fluent Bit binary.

Role Variables
--------------

The role requires the following variables:
- `gh_prerelease_tag`: The name of the GH release from [fluent-bit-package](https://github.com/newrelic/fluent-bit-package) to download the Fluent Bit package from.
- `fb_package_name`: The Fluent Bit package name to download from the GH prerelease.


Example Playbook
----------------

Example usage:

    - name: Install Fluent Bit package to be tested for this distro
      ansible.builtin.include_role:
        name: install_fluent_bit_from_gh_prerelease
      vars:
        gh_prerelease_tag: "tmp-pr-{{ pr_number }}"
        fb_package_name: "package-name" # This is typically provided as a tag in the EC2 instance