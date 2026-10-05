# Changelog

## Unreleased

- Self-host guide (`SELF-HOST.md`) for the Docker Compose path.
- Invite defaults and in-app invite copy use **Sales Coach**. The hosted From domain `refreshqueue.com` is unchanged.
- `package.json` metadata for the GitHub repository and https://refreshqueue.com.

## 0.1.0

First public OSS cut. Self-hosters can run the product without an account.

- Local Admin Mode on SQLite, with no API keys required.
- Docker Compose (`docker compose up --build`) and `npm run setup` / `npm run dev`.
- Seeded Call Bank: sample reps, stage talk-tracks, and scored calls.
- Built-in rubric for pasted transcripts when no model key is set.
- Optional LLM evaluation and audio transcription (Gemini, OpenAI, Groq, Anthropic, DeepSeek, OpenRouter).
- Rep personas and manager 1:1 talk tracks.
- Optional Clerk organizations and roles. Set `BILLING_REQUIRED=false` when Clerk is only for access control.
- Optional Resend invites, with a copyable join link when mail is not configured.
- Cloudflare Workers and D1 path for the hosted deployment, documented in the README.
