# Contributing to Sales Coach

Thanks for helping. Sales Coach is the open-source Gong alternative for call coaching and rubrics.

## Good first issues

Starter tasks are listed in [docs/good-first-issues.md](docs/good-first-issues.md). Issue forms live in `.github/ISSUE_TEMPLATE/`.

## Local setup

- Node.js 20 or 22
- npm 10+
- Git

```bash
git clone https://github.com/YOUR-USERNAME/Sales-Coach.git
cd Sales-Coach
npm install
npm run setup
npm run dev
```

[http://localhost:3000](http://localhost:3000) is the marketing page (`next dev` redirects `/` to `/app/marketing`). The product is at [http://localhost:3000/app](http://localhost:3000/app). The public sample is at [http://localhost:3000/demo](http://localhost:3000/demo) and is a static fixture: it does not write, and it does not call a model.

Self-hosters without Cloudflare credentials should set `CLEF_EVALUATION_MODE=off` in `.env.local` so their own model key does the scoring. See [SELF-HOST.md](SELF-HOST.md).

## Before a pull request

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

`npm run lint` uses the Next.js ESLint baseline in `.eslintrc.json`. Rules the tree already violates (`no-explicit-any`, unused vars, `prefer-const`, raw `<img>`, and raw `<a>` for apex URLs such as `/demo`) are off so the command can finish. Apex links stay as `<a>` so the public URL is `/demo`, not `/app/demo`.

## Pull requests

- Branches: `feat/…`, `fix/…`, or `docs/…`
- Commits: conventional style, for example `fix: keep the call list filter on the current stage`
- One purpose per pull request
- New behavior needs a test next to the code, usually `src/lib/*.test.ts`

## Where code lives

- `src/app/` — pages and route handlers. The product base path is `/app`.
- `src/app/demo/` — public read-only sample. Do not add database or model calls here.
- `src/components/` — UI
- `src/lib/ai/` — model calls (Gemini, OpenAI, Groq, Anthropic, OpenRouter), transcription, and rubric parsing
- `src/lib/db/` — SQLite and Cloudflare D1
