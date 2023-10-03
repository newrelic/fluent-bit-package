Role Name
=========

This role creates the necessary YML files under the `logging.d` directory of the Infrastructure Agent. This will result in
the Infrastructure Agent to pick them up and translate them into native Fluent Bit configurations and restart Fluent Bit
to listen on the required inputs. The integration test suite will then stress each of these inputs to validate that logs 
can be correctly captured and stored in New Relic.

Role Variables
--------------

The role requires the following variables:
- `monitored_file` (Linux, Windows): File to be tailed from
- `monitored_syslog_rfc_5424_tcp_port` (Linux): TCP port to listen to for Syslog RFC5424 formatted payloads
- `monitored_syslog_rfc_5424_udp_port` (Linux): UDP port to listen to for Syslog RFC5424 formatted payloads
- `monitored_tcp_port` (Linux, Windows): TCP port to listen to for unformatted (plain text) payloads separated by newline (\n) characters
- `monitored_systemd_unit` (Linux): Systemd unit to capture logs from
- `monitored_windows_log_name_using_winlog` (Windows): Windows Event Log channel to read logs from using the Fluent Bit `winlog` plugin (uses the old Windows Event Log API)
- `monitored_windows_log_name_using_winevtlog` (Windows): Windows Event Log channel to read logs from using the Fluent Bit `winevtlog` plugin (uses the new Windows Event Log API `winevt.h`)


Example Playbook
----------------

Example usage:

    - name: Configure log forwarding
      ansible.builtin.include_role:
        name: create_logging_configs
      vars:
        monitored_file: /path/to/file.log
        monitored_syslog_rfc_5424_tcp_port: 1234
        monitored_syslog_rfc_5424_udp_port: 5678
        monitored_tcp_port: 9012
        monitored_systemd_unit: logtar