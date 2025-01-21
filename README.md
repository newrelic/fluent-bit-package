[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# Fluent Bit Binaries for New Relic Infra Agent 

A public repo that takes care of downloading the FluentBit source, sign it and uploading the resulting artifact to be released with the New Relic [infra-agent](https://github.com/newrelic/infrastructure-agent)

## Getting Started

These assets are aimed to be used with the infra-agent. In order to install, follow the infra-agent [documentation](https://docs.newrelic.com/docs/logs/enable-log-management-new-relic/enable-log-monitoring-new-relic/forward-your-logs-using-infrastructure-agent/)

 ## Building 
Assets are being generated after a new pre-release is created and same version number.
 
### Linux packages
For `.rpm` and `.deb` artifacts are downloaded from fluent-bit and are signed by New Relic to be published in public repository. 

### Windows artifacts
About `.zip` artifacts are downloaded from fluent-bit release public git hub repository and uploaded as a release asset to be downloaded and embedded in the infra-agent.

More information about New Relic support systems, see our [docs](https://docs.newrelic.com/docs/logs/enable-log-management-new-relic/enable-log-monitoring-new-relic/forward-your-logs-using-infrastructure-agent/#requirements).

## Latest Deployments
Check the latest infra-agent release versions https://github.com/newrelic/infrastructure-agent/releases/

## License
It's licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.
