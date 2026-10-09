# Changelog

## Unreleased

- Local models: an OpenAI-compatible base URL and model name for scoring and coaching, plus an optional Whisper-compatible transcription URL.
- Public read-only demo at `/demo`: four fictional calls with transcripts, rubric scorecards, coaching notes, and trackers. Writes and model calls stay off.
- Launch README: live demo link, self-host steps, and a Gong comparison. Infrastructure and model vendor names sit in the Tech section.
- Contributor guide, issue templates, and [good first issues](docs/good-first-issues.md).
- Gong comparison disclaimer cites third-party buyer data. Gong does not publish list prices.
- Self-host docs tell installs without Cloudflare credentials to set `CLEF_EVALUATION_MODE=off`.
- Privacy policy states customer content is never used to train models. OpenRouter requests set `data_collection` to `deny`. OpenAI, Groq, and Gemini requests set `store` to false. A workspace that connects its own provider key is also covered by that provider's terms.
- HubSpot admins can map coaching summary, score, next steps, and forecast category to deal or contact properties. Updates are delivered once per value, with retries and confirmed resend after an uncertain result.
- Self-host guide (`SELF-HOST.md`) for the Docker Compose path.
- Invite defaults and in-app invite copy use **Sales Coach**. The hosted From domain `refreshqueue.com` is unchanged.
- `package.json` metadata for the GitHub repository and https://refreshqueue.com.

## 0.1.0

First public OSS cut. Self-hosters can run the product without an account.

- Local Admin Mode on SQLite, with no API keys required.
- Docker Compose (`docker compose up --build`) and `npm run setup` / `npm run dev`.
- Seeded Call Bank: sample reps, stage talk-tracks, and scored calls.
- Built-in rubric for pasted transcripts when no model key is set.
- Optional LLM evaluation and audio transcription (Gemini, OpenAI, Groq, Anthropic, OpenRouter).
- Rep personas and manager 1:1 talk tracks.
- Optional Clerk organizations and roles. Set `BILLING_REQUIRED=false` when Clerk is only for access control.
- Optional Resend invites, with a copyable join link when mail is not configured.
- Cloudflare Workers and D1 path for the hosted deployment, documented in the README.
