# Security

Tesseract stores customer names, stakeholder contacts, and engagement notes, so treat a deployment as sensitive.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). Include steps to reproduce and the affected version or commit. You should hear back within a few days.

## Deployment notes

- Set a strong `BETTER_AUTH_SECRET` and keep `.env` out of version control (it is gitignored).
- `AUTO_JOIN` defaults to `true`: anyone who can reach the sign-up page joins the first organization. Run behind your network or VPN, or set `AUTO_JOIN=false` and add members from Settings.
- `TRUSTED_ORIGINS` must list only the origins that serve the web app.
- Put TLS in front of the nginx container; cookies are session-bearing.
