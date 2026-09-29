# Trades Portal

Trades Portal is a mobile-first MVP that helps tradespeople create quotes and share them with customers through a secure public portal.

The project intentionally stays small: one tradesperson can sign up, create a quote, share its portal link, and receive an approval or rejection from the customer.

## MVP scope

- Tradesperson email/password signup and login
- Protected dashboard
- Create a quote with line items
- Generate a public customer portal link
- Customer quote review and Approve / Reject actions
- Upload, classify, and remove Before / After job photos
- Show job photos in the protected quote view and customer portal

Not included in this MVP:

- Scheduling
- Multiple technicians
- Inventory
- Online payments
- Automated reminders
- Complex reporting or analytics

## Current status

The complete MVP flow is implemented.

- `/`, `/login`, `/signup`, and `/dashboard` are available
- Supabase SSR cookie refresh and route protection are configured
- Signup email confirmation callbacks are supported
- The dashboard lists the signed-in tradesperson's quotes and their statuses
- `/quote/new` creates quotes with multiple line items and a public portal token
- `/quote/[id]` shows quote details and manages Before / After photos
- `/portal/[token]` lets customers review and approve or reject a quote

## Tech stack

- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase Auth and PostgreSQL
- `@supabase/ssr`
- `@supabase/supabase-js`

No separate backend service is required for this MVP. The application uses Next.js and Supabase directly. If a dedicated backend becomes necessary later, Python with FastAPI is the preferred direction.

## Requirements

- Node.js 22 or later
- npm
- A Supabase project

## Local setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

On PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Add your Supabase project values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Only use the Supabase publishable key in browser-accessible environment variables. Do not expose a `service_role` or secret key.

## Database setup

Database migrations are located at:

```text
supabase/migrations/20260928000000_initial_schema.sql
supabase/migrations/20260928010000_quote_photos.sql
```

It creates:

- `profiles`
- `quotes`
- `quote_items`
- `quote_photos`
- Private `quote-images` Storage bucket
- Row Level Security policies
- User profile and timestamp triggers
- Secure RPC functions for viewing and responding to public quotes by token

Run both migrations in filename order through the Supabase SQL Editor or your
usual Supabase CLI workflow. The photo migration creates the private bucket,
its RLS policies, and the portal photo metadata response.

Photo uploads accept JPG, JPEG, PNG, and WebP input. The browser resizes the
longest edge to at most 1920px, converts the result to WebP, and compresses it
below 2MB before upload. Storage and database constraints enforce the 2MB,
file type, and ten-photo limits again.

## Supabase Auth configuration

For local development, configure the following under **Authentication → URL Configuration**:

```text
Site URL: http://localhost:3000
Redirect URL: http://localhost:3000/auth/callback
```

Add equivalent production URLs before deploying.

If email confirmation is enabled, update **Authentication → Email Templates → Confirm signup** to use an SSR-compatible confirmation link:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

If email confirmation is disabled, a successful signup signs the user in immediately.

## Run the application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful routes:

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Redirect to the correct entry page | Public |
| `/signup` | Create a tradesperson account | Signed-out users |
| `/login` | Sign in | Signed-out users |
| `/dashboard` | MVP dashboard | Authenticated users |
| `/auth/callback` | PKCE email confirmation callback | Supabase Auth |
| `/auth/confirm` | Token-hash email confirmation | Supabase Auth |
| `/quote/new` | Create a quote and line items | Authenticated users |
| `/quote/[id]` | View a quote and manage Before / After photos | Quote owner |
| `/portal/[token]` | View and respond to a quote | Anyone with the secure token |

## Available scripts

```bash
npm run dev      # Start the development server with Turbopack
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
```

Before committing changes, run:

```bash
npm run lint
npm run build
```

## Project structure

```text
src/
├── app/
│   ├── auth/
│   │   ├── callback/route.ts
│   │   └── confirm/route.ts
│   ├── dashboard/page.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── auth/
├── lib/
│   ├── auth/actions.ts
│   └── supabase/
│       ├── client.ts
│       ├── middleware.ts
│       └── server.ts
├── middleware.ts
└── types/index.ts

supabase/
└── migrations/
    └── 20260928000000_initial_schema.sql
```

## Authentication flow

1. A tradesperson signs up with an email, password, and optional business name.
2. Supabase creates the Auth user, and the database trigger creates the matching profile.
3. When email confirmation is enabled, the confirmation route verifies the token and creates the cookie-based session.
4. Next.js middleware refreshes the session when needed.
5. Server-rendered protected pages verify identity with `auth.getClaims()`.
6. Logging out clears the session and redirects to `/login`.

## Quick manual test

1. Visit `/` while signed out and confirm it redirects to `/login`.
2. Test invalid email, short password, and mismatched password validation on `/signup`.
3. Create an account and confirm that Supabase contains matching `auth.users` and `profiles` rows.
4. Confirm the signup email when email confirmation is enabled.
5. Verify that the dashboard displays the signed-in email.
6. Log out and confirm that `/dashboard` redirects to `/login`.
7. Test both incorrect and correct login credentials.
8. Open a quote from the dashboard and upload Before and After photos.
9. Confirm files over the limits or unsupported formats show a clear error.
10. Open the portal link in a private window and confirm the gallery is visible.
11. Delete a photo as the quote owner and confirm it disappears from the portal.

## Deployment notes

- Configure the two public Supabase environment variables in the deployment platform.
- Update the Supabase Site URL and redirect allow list with the production domain.
- Keep authentication pages and responses that set cookies uncached.
- Never expose privileged Supabase keys to the browser.
- Run the production build before deployment.

## GitHub CI/CD

The workflow at `.github/workflows/ci-cd.yml` runs lint and a production build
for pull requests targeting `main` and for pushes to `main`. A successful push
to `main` is then deployed to Vercel production. It can also be started manually
from the GitHub Actions page.

Create a GitHub environment named `production` and add these environment
secrets:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | A Vercel account access token |
| `VERCEL_ORG_ID` | The `orgId` from `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | The `projectId` from `.vercel/project.json` after `vercel link` |

Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Vercel Production environment.
The CI job uses non-secret placeholders only to validate compilation.

If the Vercel project is connected directly to this GitHub repository, disable
Vercel's automatic Git deployments to avoid deploying the same commit twice.
