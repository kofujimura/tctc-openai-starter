# Security Policy

## Reporting a Vulnerability

Do not disclose vulnerabilities in a public issue. Use GitHub's private
vulnerability reporting for this repository when available, or contact the
maintainer at `ko@fujimura.com`.

Include the affected revision, reproduction steps, impact, and any suggested
mitigation. Do not include active API keys, private keys, seed phrases, or other
credentials in the report.

## Deployment Notes

- Use a dedicated OpenAI API key with appropriate project limits.
- Keep RPC URLs, API keys, and `SESSION_SECRET` in the deployment platform's secret store.
- Generate `SESSION_SECRET` from at least 32 random characters and rotate it if exposed.
- Review `config/tctc.config.json` before deployment.
- Keep authorization checks on the server for every protected operation.
- Serve production deployments over HTTPS.
