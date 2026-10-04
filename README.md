# Trades Portal

Trades Portal is a mobile-first MVP that helps tradespeople create quotes and share them with customers through a secure public portal.

The project intentionally stays small: one tradesperson can sign up, create a quote, share its portal link, and receive an approval or rejection from the customer.

## MVP scope

- Tradesperson email/password signup and login
- Protected dashboard
- Create a quote with line items
- Add a job title and tax rate to each quote
- Generate a public customer portal link
- Customer quote review and Approve / Reject actions
- Upload, classify, and remove Before / After job photos
- Show job photos in the protected quote view and customer portal
- Manage the business identity and contact number shown to customers
- Configure receiving bank accounts and generate offline VietQR payment requests
- Track customer transfer reports, manually confirm receipt, and review payment history
- Reconcile signed SePay incoming transfers independently for each business
- Switch between Vietnamese (default) and English across owner and customer pages
- Search the quote register and load a realistic local demo workspace

Not included in this MVP:

- Scheduling
- Multiple technicians
- Inventory
- Card payments, withdrawals, refunds, OAuth, virtual accounts and bank history imports
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
- `/settings` manages the business profile shown on customer portals

## Tech stack

- Next.js 16 with App Router
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

Demo data import is available automatically in development. To expose the
guarded importer in another non-production environment, add:

```env
ENABLE_DEMO_DATA_IMPORT=true
```

Keep this unset in production unless demo imports are explicitly required.

Only use the Supabase publishable key in browser-accessible environment variables. Do not expose a `service_role` or secret key.

SePay requires three additional server environment variables: `APP_URL`,
`SUPABASE_SECRET_KEY` and `SEPAY_ENCRYPTION_KEY`. See [the SePay setup guide](docs/sepay.md)
for key generation, migration and per-business webhook configuration. Manual
payments remain available without these variables.

## Database setup

Database migrations are located at:

```text
supabase/migrations/20260928000000_initial_schema.sql
supabase/migrations/20260928010000_quote_photos.sql
supabase/migrations/20260930000000_quote_mutations.sql
supabase/migrations/20261003000000_manual_payments.sql
supabase/migrations/20261004000000_sepay_reconciliation.sql
supabase/migrations/20261004010000_quote_edit_alias.sql
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

Run all migrations in filename order through the Supabase SQL Editor or your
usual Supabase CLI workflow. The photo migration creates the private bucket,
its RLS policies, and the portal photo metadata response.

The quote mutation migration adds authenticated, transaction-safe RPCs for
editing and duplicating quotes. Apply it before using those actions. Duplicate
quotes receive a new customer portal link and copy line items, but not photos.
The final migration qualifies columns in the edit and approval RPCs, fixing
PostgreSQL ambiguities with their output parameters on existing installations.

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
| `/settings` | Manage business identity and contact details | Authenticated users |
| `/payments` | Filter and review bank transfer requests | Authenticated owner |
| `/auth/callback` | PKCE email confirmation callback | Supabase Auth |
| `/auth/confirm` | Token-hash email confirmation | Supabase Auth |
| `/quote/new` | Create a quote and line items | Authenticated users |
| `/quote/[id]` | View a quote and manage Before / After photos | Quote owner |
| `/quote/[id]/edit` | Edit a pending quote and its line items | Quote owner |
| `/portal/[token]` | View and respond to a quote | Anyone with the secure token |
| `POST /api/payments/sepay/[connectionId]` | Receive a signed SePay transaction | HMAC authentication, independent of login |

## Language and mobile UI

Vietnamese is the default language. The selector retains the current URL and
query parameters and saves the choice in the `trades-locale` cookie. Add
`?lang=vi` or `?lang=en` to a shared portal URL to override the recipient's
saved language. User-entered titles, notes and customer details are unchanged.
Typed messages in `src/lib/i18n` are shared by server and client components.
Money uses the selected locale; transaction timestamps use Vietnam time.
Quote expiry dates retain the original end-of-day UTC rule.

Pending payment views refresh every ten seconds while the tab is visible,
stop automatically after fifteen minutes or settlement, and retain form drafts.
The manual refresh button starts another refresh window. Lists use tables on
desktop and compact rows on mobile; controls have touch targets of at least 44px.

## Bank transfer payments

Apply `20261003000000_manual_payments.sql` after the earlier migrations before
using payments. This adds the supported bank catalog, owner-scoped receiving
accounts, payment requests and append-only payment events. No new environment
variables or privileged Supabase key are required for manual payments.
Automatic reconciliation uses the separate SePay migration and server configuration.

1. In Settings, select the receiving bank, enter the account number and holder
   name, and verify the details. The app cannot check bank account ownership.
2. After a customer approves a quote, open its protected quote page, choose a
   receiving account and select **Create payment QR**. Only positive, whole VND
   totals are supported; fractional totals are rejected without rounding.
3. The customer portal displays a locally generated QR, transfer details and
   a downloadable PNG. The request expires after seven days. The transfer
   content is a unique 22-character reference; repeated creation uses the same
   live request. Cancel it first to choose another receiving account.
4. The customer selects **I have transferred** after sending the money. This
   changes the request to **Awaiting confirmation**, never to received.
5. Check the actual bank statement, enter a bank transaction reference or
   verification note, check the receipt box and select **Confirm receipt**.
   Owners may also confirm a transfer without a customer report. Use **Not
   received yet** to reopen a reported request, or **Cancel request** to stop it.
6. Payment status refreshes automatically while pending; use **Refresh payment status**
   to check again manually. Review
   the request's event history on its quote page or filter the register at
   `/payments` (25 requests per page).

Receiving account changes and disabling an account affect new requests only.
Issued requests keep their bank, account, holder and amount snapshots. Paid
requests are terminal and cannot be cancelled or reopened. Pending expired
requests cannot be reported; creating a replacement atomically cancels the old
request and preserves its history. Approved quote portals stay available past
the quote's response deadline so customers can complete payment.

Bank account and payment tables permit authenticated owners to read only their
own records. Mutations use transaction-safe RPCs; direct client writes are
revoked. A public portal token permits viewing just that quote's payment and
reporting a transfer. Owner verification notes and audit events are never
returned to portal visitors. These are transfer requests and manual receipt
records unless the receipt source explicitly identifies SePay. QR references identify
requests; they do not encrypt payment details or prove settlement.

The offline bank catalog is maintained in application code and the migration;
update both when adding a supported bank. BINs were checked against the
[VietQR bank catalog](https://api.vietqr.io/v2/banks). Payload generation follows
the NAPAS account-transfer field layout documented in the
[VietQR implementation](https://github.com/subiz/vietqr/blob/master/vietqr.go).
Neither service is called when creating or displaying QR codes. Before accepting
live payments, scan a request with your banking app and check the account,
amount and transfer content without sending money.

The automated payment tests execute the actual migrations and RPCs in PGlite
(PostgreSQL with stubbed Supabase Auth/Storage infrastructure), verify ownership
and state transitions, and decode a generated QR using an independent scanner.
SePay tests also verify signed fixtures, deduplication, rollback and retry,
tenant isolation, secret permissions, key rotation and old-payment migration.

The browser suite uses Chromium and an isolated, in-memory PostgreSQL fixture
exposed through a local Supabase-shaped HTTP adapter. It overrides all Supabase
environment values for its Next.js subprocess; it never uses `.env.local` data.
It checks both languages at 375px, 768px and 1440px and runs quote creation,
editing, duplication, customer approval, QR issuance and a signed webhook through
the actual Next.js endpoint. Screenshots and failure traces go to `test-results/`.

## Available scripts

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
npm test         # Run quote, QR, language and payment database tests
npx playwright install chromium  # Install the browser once
npm run test:e2e # Run isolated browser and webhook acceptance tests
```

Before committing changes, run:

```bash
npm run lint
npm test
npm run test:e2e
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
├── proxy.ts
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
12. Edit a pending quote and confirm the customer portal updates immediately.
13. Duplicate a quote and confirm it has a different portal link and no photos.
14. Set an expiry date and confirm expired quotes are marked on the dashboard.

## Deployment notes

- Configure the public Supabase variables and, for SePay, the three server-only variables in `.env.example`.
- Update the Supabase Site URL and redirect allow list with the production domain.
- Keep authentication pages and responses that set cookies uncached.
- Never expose privileged Supabase keys to the browser.
- Run the production build before deployment.

## GitHub CI/CD

The workflow at `.github/workflows/ci-cd.yml` runs lint, database and browser tests, and a production build
for pull requests targeting `main` and for pushes to `main`. Production deploys
are intentionally manual: start the workflow from the GitHub Actions page when
the release is ready. The deploy job runs only for that manual trigger and only
after verification passes.

Create a GitHub environment named `production` and add these environment
secrets:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | A Vercel account access token |
| `VERCEL_ORG_ID` | The `orgId` from `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | The `projectId` from `.vercel/project.json` after `vercel link` |

Configure `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the Vercel Production environment.
For SePay, also configure `APP_URL`, `SUPABASE_SECRET_KEY` and
`SEPAY_ENCRYPTION_KEY` as server-only values in that environment.
The CI job uses non-secret placeholders only to validate compilation.

If the Vercel project is connected directly to this GitHub repository, disable
Vercel's automatic Git deployments to avoid deploying the same commit twice.
