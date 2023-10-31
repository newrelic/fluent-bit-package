Role Name
=========

This roles makes the infra agent use a specific version (plugin_arch) of the NR FB output plugin.

Role Variables
--------------

The role requires the following variables:
- `plugin_arch`: The name of the plugin_architecture, matching the case of [the output plugin artifact names](https://github.com/newrelic/newrelic-fluent-bit-output/releases)
  (`arm64`, `amd64`, `386`)
- `plugin_version`: The Fluent Bit package name to download from the [NR FB Output Plugin releases](https://github.com/newrelic/newrelic-fluent-bit-output/releases)
