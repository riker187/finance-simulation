# Security Policy

## About This Project

Finance Simulation is a **client-side, self-hosted planning tool**.
All financial data lives in your browser's `localStorage` and — when the sync server is used — in a JSON file on your own server.
No data is sent to any third-party service.

## ⚠️ Sync Server — No Authentication

The built-in sync server (`sync-server/server.js`) has **no authentication, no authorization, and no access control**.

This is intentional for local/LAN use (e.g., a household sharing one Docker deployment).
**Do not expose the sync server port to the public internet without placing an authenticating reverse proxy in front of it.**
Anyone who can reach the port can read and overwrite all profile data.

Recommended setups:
- Run on a private LAN only (default Docker config)
- Place behind a VPN (e.g., WireGuard, Tailscale) for remote access
- Use an authenticating reverse proxy (e.g., Nginx with `auth_basic`, Caddy with `basicauth`) if you need internet access

## Supported Versions

This project does not use a versioned release cycle.
Security fixes are applied to the `main` branch directly.

## Reporting a Vulnerability

If you discover a security issue:

1. **Do not open a public GitHub issue.**
2. Use [GitHub's private vulnerability reporting](https://github.com/riker187/finance-simulation/security/advisories/new) to contact the maintainer confidentially.
3. You will receive a response within 7 days.

Please include:
- A description of the vulnerability and its potential impact
- Steps to reproduce
- Any suggested mitigation

## Scope

| In Scope | Out of Scope |
|----------|-------------|
| Sync server security issues | Issues requiring physical access to the host |
| Data leakage via the web UI | Self-inflicted misconfiguration (e.g., exposing port 8787 publicly) |
| XSS / injection in the React app | Vulnerabilities in underlying OS or Docker daemon |
