# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately:

**Email**: saqlainrazee@gmail.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. Please do not disclose the vulnerability publicly until it has been addressed.

## Security Features

PortKiller includes the following security measures:

- Protected system processes cannot be killed (svchost, csrss, explorer, etc.)
- PIDs 0 and 4 are blacklisted
- Admin elevation is required for killing services
- The backend re-checks the process name and port ownership before every kill, so a stale list or a reused PID cannot terminate the wrong process
- Network use is limited to the update check: one request to GitHub Releases at launch (can be turned off in Settings) and when you press "Check for updates". Updates are signature-verified and never installed without your confirmation. Nothing about your ports or processes leaves the machine.
