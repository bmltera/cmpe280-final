# JobTracker

A full-stack job tracking and discovery application for new-grad and internship positions.

## Features

- **Auto-Discovery**: Jobs scraped hourly from curated GitHub job lists
- **Job Cards**: Swipeable grid with dismiss, apply, and confirm flows
- **Kanban Board**: Drag-and-drop tracking (Applied → OA → Interview → Offer → Rejected)
- **Notes**: Per-application notes and status tracking
- **Admin Panel**: Job management, manual scraping, search & edit

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL + Auth)
- **Scraper**: Axios + Cheerio with markdown table parser
- **Deployment**: Vercel (frontend) + Render (backend)

## Quick Start

### 1. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run `supabase/migrations/001_initial_schema.sql`
3. Note your project URL, anon key, and service role key

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase credentials and admin password
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in your Supabase URL, anon key, and backend API URL
npm install
npm run dev
```

### 4. Seed Jobs

1. Go to `http://localhost:3000/admin`
2. Enter admin password
3. Click "Run Full Scrape" to populate jobs

## Project Structure

```
├── frontend/          # Next.js frontend
├── backend/           # Express API server
├── supabase/          # Database migrations
├── wireframes/        # UI wireframe references
└── prompt.txt         # Full project spec for AI agents
```

## Environment Variables

See `frontend/.env.example` and `backend/.env.example` for required variables.

## License

MIT