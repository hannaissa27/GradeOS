# GradeOS

A student productivity dashboard that connects to your Canvas LMS to track grades, plan study time, prioritize assignments, and surface AI-powered insights. Built with Next.js, TypeScript, Supabase, and a free LLM API (Groq by default; Gemini and OpenRouter also supported).

## Features

- **Canvas integration** — pulls courses, assignments, grades, and announcements via the Canvas API using a personal access token
- **Plan / Execute / Reflect workflow** — organize assignments into a study workflow with drag-and-drop time blocking
- **Live grade tracking** — see current grades and model how upcoming assignments will affect them (grade impact advisor, grade rescue, grade autopsy)
- **AI insights** — pattern analysis, procrastination detection, weekly plans, and post-grade debriefs, powered by a free LLM API
- **To-do management** — prioritized task list with due dates, course tags, and time estimates
- **Anonymous sessions** — data is keyed to an anonymous session hash, not a personal login

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Database:** Supabase (Postgres)
- **AI:** Groq (`openai/gpt-oss-20b`) by default — or Google Gemini / OpenRouter, switchable with env vars
- **UI:** Tailwind CSS 4, shadcn/ui (Radix primitives), Framer Motion
- **Drag & drop:** dnd-kit

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A free AI API key — [Groq](https://console.groq.com/keys) recommended (Gemini or OpenRouter also work)
- A Canvas LMS access token (generated from your Canvas account settings)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/GradeOS.git
cd GradeOS
npm install
```

### Environment setup

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Then set:

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `GROQ_API_KEY` | Groq Console → API Keys (free) |
| `GEMINI_API_KEY` | *(alternative)* Google AI Studio → Get API key |
| `OPENROUTER_API_KEY` | *(alternative)* OpenRouter → Keys; use a `:free` model |
| `AI_PROVIDER` / `AI_MODEL` | *(optional)* force a provider (`groq`, `gemini`, `openrouter`) or a specific model id |

The provider is inferred from whichever key is present. Defaults: Groq → `openai/gpt-oss-20b`, Gemini → `gemini-2.5-flash`, OpenRouter → `meta-llama/llama-3.3-70b-instruct:free`.

> **Why not Llama 3.1?** Groq retired `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` on 16 Aug 2026. If AI features ever stop working with a "model decommissioned" error, set `AI_MODEL` to a current model from [Groq's model list](https://console.groq.com/docs/models).

### Database setup

Run the schema against your Supabase project (SQL Editor, or psql):

```bash
scripts/001_create_tables.sql
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connecting Canvas

In the app, open the connection modal and provide your Canvas URL (e.g. `https://yourschool.instructure.com`) and a personal access token. Without a connection, the app runs against built-in mock data so you can explore the UI.

**Note on the Canvas token:** it is sent with each request to the app's server-side proxy and held in your browser, not committed to the repo or stored on a shared server. Treat it like a password — anyone with access to your logged-in browser could read it. Revoke it from Canvas settings if exposed.

## Project Structure

```
app/            Next.js routes, API endpoints (ai, canvas), pages
components/     Feature components + shadcn/ui primitives
lib/            Canvas service, AI utils, grade calculations, Supabase clients
hooks/          Custom React hooks
scripts/        SQL schema
```

## Security

No secrets are committed to this repository. The Supabase and AI keys are read from environment variables, and the Canvas token is supplied at runtime. Keep your real keys in `.env.local`, which is gitignored.

## License

See [LICENSE](LICENSE).
