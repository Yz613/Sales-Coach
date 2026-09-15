# Contributing to Sales Coach AI

Thank you for your interest in contributing to Sales Coach AI! We welcome contributions from the community.

## Getting Started

### Prerequisites
- **Node.js**: v20 or v22 LTS
- **npm**: v10+
- **Git**

### Local Development Setup

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/Sales-Coach.git
   cd Sales-Coach
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run One-Step Setup:**
   ```bash
   npm run setup
   ```
   *This automatically sets up `.env.local` and seeds the local SQLite database.*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) (redirects to `/app`).

---

## Code Quality & Verification

Before opening a pull request, ensure all checks pass:

```bash
# 1. Run all unit and integration tests
npm test

# 2. Check TypeScript type definitions
npx tsc --noEmit

# 3. Verify production Next.js build
npm run build
```

---

## Pull Request Guidelines

1. **Branch Naming:** Use clear branch prefixes:
   - `feat/feature-name` for new features
   - `fix/bug-description` for fixes
   - `docs/update-description` for documentation
2. **Commit Messages:** Follow conventional commits (e.g. `feat: add support for Claude 3.7`, `fix: resolve transcript auto-scroll on safari`).
3. **Keep PRs Focused:** Small, single-purpose pull requests are much easier to review and merge quickly.
4. **Include Tests:** If you add new functionality, please add corresponding unit tests in `src/lib/*.test.ts`.

---

## Architecture Overview

- **`src/app/`**: Next.js App Router pages and API route handlers (under `/app` basePath).
- **`src/components/`**: Reusable React UI components (Tailwind CSS, Glassmorphic design).
- **`src/lib/ai/`**: Multi-provider LLM integrations (Gemini, OpenAI, Groq, Anthropic, DeepSeek, OpenRouter), transcription, and rubric parsing.
- **`src/lib/db/`**: Database services supporting both local SQLite (`better-sqlite3`) and Cloudflare D1 (`drizzle-orm`).

Thank you for helping make Sales Coach better!
