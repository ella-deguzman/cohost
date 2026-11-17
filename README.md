# AI Co-Host — MVP Step 1

Sign in, create an event draft, and reopen it later. This uses the planning-folder design from the prototype.
No AI yet: that is MVP Step 3 in the design doc.

## What works

- **Sign in with an email link.** No passwords. Links work once and expire after 15 minutes.
- **Create a draft** through the same three worksheets as the prototype. It saves at every step.
  Only the event name is required (as in the design doc).
- **My events** lists your drafts. Click one to reopen and edit it. Time zone and location are kept.
- **Privacy:** only the host can open or edit an event. Someone else's event looks like a missing page.
- **Stale edits are caught.** If a draft was saved from another tab, you are asked to reload instead of overwriting it.

## What is not built yet

Menu, shopping items, budget math, AI drafts, invitations/RSVP, co-hosts. Email delivery is also not set up:
in development the sign-in link is shown on the sign-in page and printed in the terminal.
In production, sign-in refuses to run until a real email provider is added in `lib/email.ts`.

## Run it on your computer

You need Node.js 20 or newer, and a Postgres database.

1. **Start Postgres.** Easiest is Docker: `docker compose up -d`
   (any local Postgres works; adjust `DATABASE_URL` below).
2. **Create your settings file:** `cp .env.example .env.local`
3. **Install:** `npm install`
4. **Create the tables:** `npm run db:migrate` (safe to run again)
5. **Start the app:** `npm run dev`, then open http://localhost:3000

Sign in with any email address. The link appears on the page, so click "Sign in now".

## Try the "done" checks from the design doc (Step 1)

- Sign in, create a draft, close the tab, sign in again, reopen it: everything is still there.
- Sign in as a second email (use a private window). Paste the first user's event URL: you get "couldn't find that page".
- Open the same draft in two tabs, save in one, then save in the other: the second shows the reload message.

## Where things are

| Folder | What it holds |
|---|---|
| `app/` | Pages: cover, sign-in, My events, the event planner |
| `components/PlannerForm.tsx` | The three-step planner from the prototype |
| `lib/auth.ts` | Sign-in links and sessions |
| `lib/events.ts` | Saving and reading events, with the access and version checks |
| `lib/validate.ts` | Checks for every field before saving |
| `db/schema.sql` | The tables (users, events, event_members, sign-in tokens, sessions) |

## Known limits of this first version

- Opening the sign-in link uses it up. Some email programs pre-open links, which could use it before you do. Fix this when real email is added.
- Request limits are minimal (5 sign-in links per email per hour). Add broader limits before launch.

## Updating the database after new code

When a new build step adds a column or table, run `npm run db:migrate` again. It is safe to run any number of times and keeps your existing events. (The idea board on each event needs this once.)
