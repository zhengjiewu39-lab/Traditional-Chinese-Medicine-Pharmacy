# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` branch | Yes |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report via one of:

- **GitHub Security Advisories**: [Report a vulnerability](https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy/security/advisories/new) on this repository
- **Email**: open a private GitHub issue or contact the maintainer listed in the repository profile

Include:

- Description of the issue and potential impact
- Steps to reproduce
- Affected version / commit hash
- Suggested fix (if any)

## Response timeline

- **Acknowledgment**: within 72 hours
- **Initial assessment**: within 7 days
- **Fix or mitigation plan**: as soon as reasonably possible, depending on severity

## Scope

In scope:

- Authentication / authorization bypass
- Injection, SSRF, path traversal in API routes
- Sensitive data exposure (credentials, patient data)
- Dependency vulnerabilities with exploitable impact

Out of scope:

- Denial-of-service against demo deployments without production impact
- Issues requiring physical access to a developer machine
- Social engineering

## Safe harbor

We appreciate responsible disclosure. Researchers who follow this policy will not be pursued for good-faith security research on this project.
