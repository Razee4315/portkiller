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
- No network communication (fully offline)
