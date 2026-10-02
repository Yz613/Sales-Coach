# Self-host Sales Coach

Run Sales Coach on your own machine with Docker Compose. You do not need API keys, Clerk, or Stripe to look around. The hosted product lives at [refreshqueue.com](https://refreshqueue.com). Cloudflare Workers, D1, and hosted billing are in the [README](README.md#deploying-to-cloudflare-workers).

## Requirements

- Docker with Compose v2 (`docker compose`, not the older `docker-compose` binary)

## Start

```bash
git clone https://github.com/Yz613/Sales-Coach.git
cd Sales-Coach
docker compose up --build
```

The image build runs `npm run db:seed`, so the container already has a SQLite file (`sales_coach.db`) with sample reps, stage scripts, and four scored calls. The first start can take a few minutes while dependencies compile.

## What to open

`docker compose` uses `next start`. Typing [http://localhost:3000](http://localhost:3000) follows a redirect to `/app/marketing` (the marketing page, including pricing). On Cloudflare the same landing stays at `/`; that difference is only the hosted worker.

| URL | What you see |
| --- | --- |
| [http://localhost:3000](http://localhost:3000) | Marketing landing (redirects to `/app/marketing`) |
| [http://localhost:3000/app](http://localhost:3000/app) | Product home |
| [http://localhost:3000/app/calls](http://localhost:3000/app/calls) | Call Bank |

The header badge says **Local Admin**. With no Clerk keys you have the admin nav: Dashboard, Calls, Coach, Reps, plus Analytics, Scripts, and Settings. Nothing asks you to sign in.

### Call Bank

Open **Calls**. Four seeded calls are already scored (no model call):

- Marcus Vance — cold call, Apex Logistics (meeting booked)
- David Kim — cold call, Meridian BioTech (dropped)
- Chloe Bennett — first discovery, Titan Heavy Supply
- Sarah Jenkins — follow-up, Veritas Health Tech

Open any row for the transcript and scorecard. Paste a new transcript from **Upload** and the built-in rubric can grade it with zero API keys. Uploading MP3, WAV, or M4A needs a transcription key (next section).

## Add API keys later

You can stay on the rubric until you want model scoring or audio transcription.

**In the app:** Admin menu → **Settings** → pick a provider → paste the key → **Save** → **Test Key**.

**In Compose:** uncomment or add a variable under `environment` in `docker-compose.yml`, then `docker compose up --build` again:

```yaml
environment:
  - GEMINI_API_KEY=your_key_here
  # - OPENAI_API_KEY=
  # - GROQ_API_KEY=
  # - ANTHROPIC_API_KEY=
  # - DEEPSEEK_API_KEY=
  # - OPENROUTER_API_KEY=
```

Providers: Gemini, OpenAI, Groq, Anthropic, DeepSeek, OpenRouter. Audio transcription uses Gemini, OpenAI (Whisper), or Groq (Whisper). Pasted text works with any of them, or with the built-in rubric.

Keys saved only in Settings live in `sales_coach.db` inside the container. The Compose volume mounts `/app/data`, not that file, so a rebuild can drop UI-saved keys. Put keys you care about in `environment`.

Node without Docker (`npm run setup`, then `npm run dev`) is Option 1 in the [README Quickstart](README.md#quickstart).

## Optional Clerk, without billing

Leave Clerk unset if Local Admin Mode is enough.

To add team logins on a self-hosted box, create a [Clerk](https://clerk.com) application, enable Organizations, and pass both keys. When both keys are set, billing turns on unless you opt out. Set `BILLING_REQUIRED=false` so teammates are not sent through Stripe Checkout.

```yaml
environment:
  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
  - CLERK_SECRET_KEY=sk_test_...
  - BILLING_REQUIRED=false
```

`NEXT_PUBLIC_*` values are read at image build. After you add the publishable key, run `docker compose up --build` again (do not only restart). Admins can invite people; members land on the Call Bank.

### Invite mail

Product name defaults to **Sales Coach** (`INVITE_PRODUCT_NAME`). Leave `RESEND_FROM_EMAIL` empty until you verify a domain you control in [Resend](https://resend.com). Addresses at `example.com` are ignored on purpose. A copyable join link is still saved under Pending invites if mail cannot send. Clerk can also send the invite from whatever domain that Clerk app uses.

```bash
RESEND_API_KEY=re_...
# RESEND_FROM_EMAIL="Sales Coach <invites@example.com>"
INVITE_PRODUCT_NAME="Sales Coach"
```

Hosted mail from `invites@refreshqueue.com` is only for [refreshqueue.com](https://refreshqueue.com). Do not copy that address into a self-hosted install.

## Stop

```bash
docker compose down
```

That stops the container. It does not delete the named volume. Sample data from the image is recreated on the next build.
