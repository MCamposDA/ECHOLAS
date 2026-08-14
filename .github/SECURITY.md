# Security Policy

## Supported Versions

ECHOLAS doesn't currently ship versioned releases — the `main` branch is the
only supported line. Security fixes are applied there.

## Scope

This covers the Nextflow pipeline and modules (`main.nf`, `modules/`,
`scripts/`), the Docker image (`Dockerfile`, `docker/`), and the dashboard's
FastAPI backend (`docker/backend.py`). Third-party bioinformatics tools
pinned in `docker/envs/echolas.yml` should be reported upstream instead.

## Reporting a Vulnerability

Please **do not** open a public Issue for security vulnerabilities.

Instead, report it privately by emailing
**matheuscamposdeandrade@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (or a proof of concept)
- Any relevant logs, versions, or configuration

You should get an initial response within a few days. We'll work with you to
understand and fix the issue, and to agree on a disclosure timeline before
any public write-up.

If you'd rather use GitHub's built-in reporting flow, the maintainer can
enable **Private vulnerability reporting** for this repository under
*Settings → Security* — once enabled, a "Report a vulnerability" button
appears under the Security tab.
