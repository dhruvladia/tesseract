# Security

Tesseract stores customer names, stakeholder contacts, and engagement notes, so treat a deployment as sensitive.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting on this repository ("Security" tab, "Report a vulnerability"). Include steps to reproduce and the affected version or commit. You should hear back within a few days.

## Deployment notes

- Set a strong `BETTER_AUTH_SECRET` and keep `.env` out of version control (it is gitignored).
- `AUTO_JOIN` defaults to `true`: anyone who can reach the sign-up page joins the first organization. Run behind your network or VPN, or set `AUTO_JOIN=false` and add members from Settings.
- `TRUSTED_ORIGINS` must list only the origins that serve the web app.
- Put TLS in front of the nginx container; cookies are session-bearing.
- If `LLM_PROVIDER` is set, everything you type or say to the agent (plus the tool results it reads, which include customer and stakeholder names) and text pasted into "Draft from notes" is sent to that provider (plus the engagement name, account name, decision, stakeholder names, and outcome metric names) and stored in the `handoff_source` table. Use a provider and data-processing agreement that fits your customers' contracts, or point `openai-compatible` at a model you host. Leave `LLM_PROVIDER` unset to disable the feature entirely. The agent can only do what the signed-in user can do, through the same API, and every write requires an explicit approval in the chat.
