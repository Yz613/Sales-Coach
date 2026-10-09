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
  - CLEF_EVALUATION_MODE=off
  - GEMINI_API_KEY=your_key_here
  # - OPENAI_API_KEY=
  # - GROQ_API_KEY=
  # - ANTHROPIC_API_KEY=
  # - OPENROUTER_API_KEY=
```

Providers: Gemini, OpenAI, Groq, Anthropic, OpenRouter. Audio transcription uses Gemini, OpenAI (Whisper), or Groq (Whisper). Pasted text works with any of them, or with the built-in rubric.

## Score with your own model key

If `CLEF_EVALUATION_MODE` is unset, scoring tries a hosted evaluator that needs Cloudflare credentials. A self-hosted machine does not have those credentials, so the call falls through to the built-in rubric and your provider key is not used.

Set `CLEF_EVALUATION_MODE=off` so the key you saved does the scoring. Compose should pass that variable in `environment` (see the block above). For `npm run dev`, put the same line in `.env.local`. With no key at all, pasted transcripts still use the built-in rubric.

## Local model server

You can score and coach with an OpenAI-compatible server on your own machine, such as Ollama or LM Studio. In Admin, then Settings, choose Local, set the base URL (for Ollama that is `http://127.0.0.1:11434/v1`), and set the model name the server is serving. The API key can be any non-empty value, or left blank.

The same base URL is used for call scoring and for coaching notes. Audio is separate. If you run a Whisper-compatible server, set its base URL too (the path is `/v1`, and Sales Coach calls `/v1/audio/transcriptions`). Leave that blank to keep using a Gemini, OpenAI, or Groq key for recordings.

A localhost or LAN address is refused unless the process has `ALLOW_PRIVATE_MODEL_URLS=true`. Compose sets that. For `npm run dev`, add it to `.env.local`. From inside Compose, `127.0.0.1` is the container, not your machine. Point the base URL at the host, for example `http://host.docker.internal:11434/v1`.

```yaml
environment:
  - CLEF_EVALUATION_MODE=off
  - ALLOW_PRIVATE_MODEL_URLS=true
  - LOCAL_OPENAI_BASE_URL=http://host.docker.internal:11434/v1
  - LOCAL_OPENAI_MODEL=llama3.1
  # - LOCAL_WHISPER_BASE_URL=http://host.docker.internal:9000/v1
```

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

## Company lookup

The hosted site caches company lookups in Workers KV. Docker and `npm run dev` do not have that binding, and they do not need it. When `VISITOR_COMPANY_KV` is missing, the app keeps an in-memory cache for the life of the process. Do not paste the hosted namespace id into a self-hosted install. If you deploy your own worker, create a separate namespace and add that id under `kv_namespaces` in `wrangler.jsonc`.

## Returning visitor follow-up

Optional. Leave the variables unset and Sales Coach does not call the service, and the browser snippet is not added. Marketing pages do not mention it.

The server uses `VISITOR_FOLLOW_UP_ENDPOINT` and `VISITOR_FOLLOW_UP_API_KEY`. The site id in each JSON body is `sales-coach`. Requests send `Authorization: Bearer` plus that key. The browser snippet uses `NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT`, which Next reads when the image or app is built. A hosted example is `https://followup.refreshqueue.com`.

Only addresses someone typed into an integration request, or used to create an account, are sent. Teammate invites and the footer mail link are not. Paying customers are marked so they are left out of follow-up.

For `wrangler dev` and other local Cloudflare runs, put the same names in `.dev.vars` at the project root. That file is gitignored. Do not commit it.

```yaml
environment:
  - VISITOR_FOLLOW_UP_ENDPOINT=https://followup.example.com
  - VISITOR_FOLLOW_UP_API_KEY=your_site_key
  - NEXT_PUBLIC_VISITOR_FOLLOW_UP_ENDPOINT=https://followup.example.com
```

`NEXT_PUBLIC_*` is read at image build. After you add the public endpoint, run `docker compose up --build` again (do not only restart).

In production, set the endpoint in the build environment and the Worker environment, and store the key with `npx wrangler secret put VISITOR_FOLLOW_UP_API_KEY`. Do not commit the key.

## Stop

```bash
docker compose down
```

That stops the container. It does not delete the named volume. Sample data from the image is recreated on the next build.
