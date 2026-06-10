# GradeOS

A student productivity dashboard that connects to your Canvas LMS to track grades, plan study time, prioritize assignments, and surface AI-powered insights. Built with Next.js, TypeScript, Supabase, and Groq.

## Features

- **Canvas integration** — pulls courses, assignments, grades, and announcements via the Canvas API using a personal access token
- **Plan / Execute / Reflect workflow** — organize assignments into a study workflow with drag-and-drop time blocking
- **Live grade tracking** — see current grades and model how upcoming assignments will affect them (grade impact advisor, grade rescue, grade autopsy)
- **AI insights** — pattern analysis, procrastination detection, weekly briefs, and post-grade debriefs, powered by Groq (Llama 3.1)
- **To-do management** — prioritized task list with due dates, course tags, and time estimates
- **Anonymous sessions** — data is keyed to an anonymous session hash, not a personal login

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript
- **Database:** Supabase (Postgres)
- **AI:** Groq API (Llama 3.1 8B)
- **UI:** Tailwind CSS 4, shadcn/ui (Radix primitives), Framer Motion
- **Drag & drop:** dnd-kit

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [Groq API key](https://console.groq.com/keys)
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
| `GROQ_API_KEY` | Groq Console → API Keys |

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

No secrets are committed to this repository. The Supabase and Groq keys are read from environment variables, and the Canvas token is supplied at runtime. Keep your real keys in `.env.local`, which is gitignored.

## License

See [LICENSE](LICENSE).
