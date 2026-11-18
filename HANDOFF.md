# Maintainer Handoff & Operations Runbook

This document describes how to operate, update, and cleanly transfer ownership of **AMAES Toolkit** without exposing personal identities or relying on fragile GitHub-only endpoints.

---

## 1. Architecture Summary

- **Browser Extension (`extension/`)**: Built with WXT (MV3) for Chrome/Edge and Firefox. Fetches dynamic links and version metadata from `GET /v1/config` on the Cloudflare Worker rather than hardcoding GitHub URLs.
- **Cloudflare Relay (`database/relay/worker.js`)**: Stores community answer submissions, anomaly reports, and bug reports directly in **Cloudflare D1**. Never calls the GitHub Issues API.
- **Daily Public Database Sync (`database/.github/workflows/daily-sync.yml`)**: A scheduled GitHub Actions workflow runs once per day (`17 3 * * *`), pulls pending D1 submissions via `GET /v1/export?markExported=1`, and commits updated `data/*.json` files using `github-actions[bot]`.

---

## 2. Initial Deployment Checklist

1. **Domain & DNS**:
   - Register a custom domain with WHOIS Privacy enabled under a dedicated project email alias.
   - Proxy `api.<your-domain>` through Cloudflare DNS and bind it to `amaes-community-relay` in `database/relay/wrangler.toml`.
2. **Cloudflare D1 & Secrets**:
   - Apply all SQL migrations in `database/migrations/` (`wrangler d1 migrations apply amaes-community-relay --remote`).
   - Set the export secret: `wrangler secret put EXPORT_SECRET`.
   - Set `PUBLIC_HOMEPAGE_URL`, `PUBLIC_SUPPORT_URL`, `PUBLIC_REPO_URL`, `PUBLIC_DATABASE_URL`, `PUBLIC_MIRROR_URL`, and `PUBLIC_EXTENSION_URL` in `database/relay/wrangler.toml` or Cloudflare Dashboard.
3. **GitHub Organization & Daily Sync**:
   - Create a GitHub Organization (keep **membership Private** in Org settings).
   - In the `database` repository settings, add:
     - Repository Variable: `RELAY_BASE_URL` = `https://api.<your-domain>`
     - Repository Secret: `EXPORT_SECRET` = same secret set on the Cloudflare Worker.
   - Update `API_BASE_URL` in `extension/utils/config.ts` and `host_permissions` in `extension/wxt.config.ts` to match `https://api.<your-domain>/*`.

---

## 3. Maintainer OPSEC Rules

- **Git Author Hygiene**: Always commit via CLI using a neutral role identity (`git config user.name "AcademicContributor"` and `git config user.email "academic-contributor@users.noreply.github.com"`).
- **Avoid Web UI Edits/Merges on Public Repos**: Using the GitHub Web UI "Edit" or "Merge" button attaches your GitHub account username to the commit history.
- **Run Identity Check Before Pushing**: Run `bash extension/scripts/check-identity.sh` to verify no personal usernames, local home paths, or secrets are staged.
- **No Code Obfuscation**: Keep the extension open-source (MIT) and use standard WXT/Vite production builds (`npm run build`, `npm run zip`) so Chrome Web Store and Firefox AMO reviews pass cleanly.

---

## 4. How to Hand Off to the Next Maintainer

1. **GitHub Organization**:
   - Go to **Org Settings -> People -> Invite member** and invite the next maintainer's GitHub account as **Owner**.
   - Once they accept, remove your own account from the Org.
2. **Cloudflare & Domain Registrar**:
   - Invite the next maintainer as **Super Administrator** on the Cloudflare account (or transfer the domain/email alias forwarding and reset 2FA together).
   - Once verified, remove your own Cloudflare access.
3. **Rotate Secrets**:
   - The incoming maintainer should immediately rotate `EXPORT_SECRET` in both Cloudflare (`wrangler secret put EXPORT_SECRET`) and GitHub Actions (`secrets.EXPORT_SECRET`), as well as any `ADMIN_KEY` / `GEMINI_KEY_ENCRYPTION_SECRET`.
4. **Store Publisher Accounts**:
   - Transfer the Chrome Web Store / Firefox AMO extension listing to the new maintainer's publisher group/account.
