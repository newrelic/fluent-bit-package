<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**  *generated with [DocToc](https://github.com/thlorenz/doctoc)*

- [Fluent Bit Tests](#fluent-bit-tests)
  - [Where did this code come from?](#where-did-this-code-come-from)
  - [Environment Variables](#environment-variables)
  - [Internal data types](#internal-data-types)
    - [Account](#account)
    - [QueryOptions](#queryoptions)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

# Fluent Bit Tests

These are NodeJS tests that assumes that (a) Fluent Bit is running and (b) is
configured to monitor various `input`s. 

The information about what Fluent Bit is monitoring is passed in the 
[Environment Variables](#environment-variables) section. 

If a specific environment variable is not set, the tests will assume that
Fluent Bit is not monitoring that specific thing, and will skip the test.
We use this functionality to skip behavior that Windows does not support.

## Environment Variables

The tests are configured with environment variables.

These environment variables are needed to talk to NerdGraph:

| Name                                 | Description                                                                                           |
|--------------------------------------|-------------------------------------------------------------------------------------------------------|
| ACCOUNT_ID                           | the account ID                                                                                        |
| API_KEY                              | the value to put in the Api-Key header on queries                                                     |
| NERD_GRAPH_URL                       | the URL of the NerdGraph API in the environment                                                       |

These environment variables are used to let the tests know what Fluent Bit is monitoring.

If a specific environment variable is not set, the tests will assume that
Fluent Bit is not monitoring that specific thing, and will skip the test.
We use this functionality to skip behavior that Windows does not support.

| Name                                       | Description                                                                                            |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------|
| MONITORED_FILE                             | the absolute path of a file monitored by Fluent Bit's `tail` input                                     |
| MONITORED_TCP_PORT                         | the TCP port of a socket monitored by Fluent Bit's `tcp` input                                         |
| MONITORED_SYSLOG_RFC_5424_TCP_PORT         | the port of a TCP socket monitored by Fluent Bit's `syslog` input of mode `tcp` for RFC 5424 messages  |
| MONITORED_SYSLOG_RFC_5424_UDP_PORT         | the port of a UDP socket monitored by Fluent Bit's `syslog` input of mode `tcp` for RFC 5424 messages  |
| MONITORED_SYSTEMD_UNIT                     | the systemd unit being monitored with Fluent Bit's `systemd` input (and filtered with `_SYSTEMD_UNIT`) |
| MONITORED_WINDOWS_LOG_NAME_USING_WINLOG    | The name of the Windows Event Log being monitored by Fluent Bit's `winlog` input                       | 
| MONITORED_WINDOWS_LOG_NAME_USING_WINEVTLOG | The name of the Windows Event Log being monitored by Fluent Bit's `winevtlog` input                    |   

## Internal data types

This describes JavaScript data types used in the test code. 

### Account

Used when constructing `Nrdb`

| Name         | Type   | Description                                       | Required? | Default |
|--------------|--------|---------------------------------------------------|-----------|---------|
| accountId    | number | the account ID                                    | Yes       | -       |
| apiKey       | string | the value to put in the Api-Key header on queries | Yes       | -       |
| nerdGraphUrl | string | the URL of the NerdGraph API in the environment   | Yes       | -       |

### QueryOptions

Used when querying events using one of the `Nrdb.find*` methods

| Name                        | Type                                                               | Description                                                     | Required? | Default                    |
|-----------------------------|--------------------------------------------------------------------|-----------------------------------------------------------------|-----------|----------------------------|
| select                      | string                                                             | What to select                                                  | No        | `*`                        |
| from                        | string                                                             | What event type to query                                        | No        | `Log`                      |
| where                       | string                                                             | What to put in a `WHERE` clause                                 | No        | (none)                     |
| limit                       | number                                                             | What to put for a `LIMIT`                                       | No        | `2000`                     |
| wait                        | number                                                             | Time (in milliseconds) to wait for events to show up in NRDB    | No        | `WAIT_FOR_PROCESSING`      |
| since                       | number                                                             | What to put for `SINCE`                                         | No        | `5 minutes ago`            |
| until                       | number                                                             | What to put for `UNTIL`                                         | No        | (none)                     |
| didNotFindAllResultsMessage | function(foundResults: array, expectedResultCount: number): string | What message to output when the query fails to find all results | No        | (a sensible error message) |
