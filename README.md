# Split Kit

**Expense splitting for groups. No account required.**

Share a 6-digit code. Everyone's in. No sign-up, no passwords. Just split the bill and move on with your life. 

---

## Why Split Kit

Most expense apps make you manage a contact list, send friend requests, or convince your group to all install the same thing before your trip even starts. Split Kit skips all of that.

A project lives as long as you need it — a weekend trip, a group dinner, a two-week backpacking adventure. When it's done, it's done. No accounts to delete, no data to worry about.

**It's designed for:**
- Group travel (the main one)
- Short-term shared expenses with people you might never app-coordinate with again
- Anyone who thinks "just create an account" is too many words

---

## What It Does

- **6-digit join code** — share it in a group chat; everyone joins on their own device, no account needed
- **Multi-currency** — log expenses in 150+ currencies; balances auto-convert to USD so nobody argues about exchange rates at dinner
- **Smart settlement** — figures out the fewest possible payments to settle all debts. Math is hard; this handles it.
- **Real-time sync** — log an expense and your whole group sees it immediately
- **Travel-tuned categories** — Flights, Accommodation, Activities, Car Rental, Visa & Fees, and more — ordered by how often you'll actually use them
- **Spend trend** — mini chart showing daily spend over the trip, so you can see exactly when things got out of hand
- **Member avatars** — upload a photo from your profile; it shows up in expense pills, the summary, settlements, and analytics filters
- **Optional accounts** — sign in with a magic link to save your projects to an account and access them from any device; the app works fine without it
- **Installable** — add to your home screen; works like a native app

---

## Stack

React + Vite · Supabase (Postgres + real-time) · Vercel · No TypeScript · No UI framework

---

## Setup

```bash
npm install
cp .env.example .env   # add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Supabase: run `supabase/schema.sql` in the SQL Editor, then disable RLS on all three tables. To enable magic link sign-in, go to Authentication → URL Configuration and add your app's URL to the redirect allow-list.

Deploy: push to GitHub, import in Vercel, add the two env vars. Done.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
