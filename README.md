[![New Relic Experimental header](https://github.com/newrelic/open-source-office/raw/master/examples/categories/images/Experimental.png)](https://github.com/newrelic/open-source-office/blob/master/examples/categories/index.md#category-new-relic-experimental)

# Fluent Bit Binaries for New Relic

A public repo that takes care of downloading the FluentBit source, compiling it and uploading the resulting artifact to be released with the NewRelic [infra-agent](https://github.com/newrelic/infrastructure-agent)

## Getting Started

These artifacts are aimed to be used with the infra-agent. In order to install, follow the infra-agent [documentation](https://docs.newrelic.com/docs/logs/enable-log-management-new-relic/enable-log-monitoring-new-relic/forward-your-logs-using-infrastructure-agent/)

## Building

Update the `nr_fb_version` file with the desired version. The GitHubActions will trigger the build pipeline.

## Latest Deployments

Check the latest infra-agent release versions https://github.com/newrelic/infrastructure-agent/releases/

## License
It's licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
