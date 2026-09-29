# AgentU — Multi-Agent HR Automation

TalentFlow is the codebase behind AgentU, a Next.js app that lets an HR agent publish job openings, collect applications, and use AI to screen and rank candidates.

## How the HR agent works

1. **Company profile.** The recruiter tells the agent about their company once (name, about, industry, location, size, culture, and where to send email updates). Every listing, LinkedIn post, and public job page is written from this profile.
2. **Publish.** When a recruiter posts a job, the agent writes a polished listing with Gemini, publishes it at a public link (`/careers/<slug>`), and makes it shareable on LinkedIn (one-click **Share on LinkedIn**, or automatic posting if a LinkedIn app is configured). Public job pages carry `JobPosting` structured data so Google for Jobs can index them.
3. **Email updates.** The recruiter is emailed when the job goes live (public link + LinkedIn status), every time a candidate applies (AI score, evaluation, matched/missing skills), and when their existing candidate pool is re-scored for a new role.
4. **Live activity.** Each step the agent takes is recorded and streamed into the dashboard's *Agent activity* feed, and the pipeline refreshes automatically as applications arrive.

## LinkedIn sharing

No setup is needed for the **Share on LinkedIn** button on each job card: it opens LinkedIn's own share dialog with the job link and copies a ready-made post to the clipboard.

### Optional: automatic posting

Automatic posting requires a LinkedIn developer app, which LinkedIn may not approve. Each recruiter connects **their own** LinkedIn account from the dashboard (OAuth 2.0).

1. Create an app at <https://www.linkedin.com/developers/apps> and add the **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn** products.
2. Under *Auth*, add the redirect URL `<NEXT_PUBLIC_APP_URL>/api/linkedin/callback` (e.g. `http://localhost:3000/api/linkedin/callback`).
3. Add the credentials to `.env`:

```bash
LINKEDIN_CLIENT_ID="your-client-id"
LINKEDIN_CLIENT_SECRET="your-client-secret"
# Optional — defaults to "openid profile w_member_social".
# Add w_organization_social only if your app is approved for the Community Management API.
LINKEDIN_SCOPES="openid profile w_member_social"
```

4. In the dashboard, click **Connect LinkedIn**. Jobs post as the recruiter's profile by default; choose **Post as company page** and enter the page ID to post as a company (requires the Community Management API product and page admin rights).

Access tokens are stored encrypted with `AUTH_SECRET` and last about 60 days; the dashboard shows when to reconnect. If LinkedIn isn't configured or connected, publishing still works — the automatic post is skipped and the job can be shared with the button instead.

LinkedIn link previews use the Open Graph tags on the public job page, so `NEXT_PUBLIC_APP_URL` must be a publicly reachable URL for the preview card to render (LinkedIn can't fetch `localhost`).

## Automatic distribution

After a job is published the agent distributes it without any platform approval. Each channel is optional and turns on when its variables are set; results appear in the dashboard's activity feed.

```bash
# Google for Jobs: notify Google's Indexing API on publish/delete (see the deploy guide below).
GOOGLE_INDEXING_CREDENTIALS='{"type":"service_account",...}'   # the service account JSON key
GOOGLE_SITE_VERIFICATION="token-from-search-console"            # HTML-tag verification

# Discord: Server settings -> Integrations -> Webhooks -> New Webhook -> Copy URL.
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Telegram: create a bot with @BotFather, add it as an admin of a public channel.
TELEGRAM_BOT_TOKEN="123456:ABC..."
TELEGRAM_CHAT_ID="@your_channel"
```

`/sitemap.xml` lists every published role and `/robots.txt` points crawlers to it.

## Email updates setup

Recruiter notifications are sent over SMTP:

```bash
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="you@example.com"
EMAIL_PASS="app-password"
EMAIL_FROM="AgentU <you@example.com>"
```

For Gmail, create an [app password](https://myaccount.google.com/apppasswords). Without SMTP settings the agent keeps working and logs "email not sent" in the activity feed.

## Database

After pulling these changes, sync the schema:

```bash
npm run db:push
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy (free): Vercel + TiDB Cloud

1. Create a free **TiDB Cloud** cluster (MySQL-compatible) and copy its connection string. Append `?sslaccept=strict` so both the Prisma CLI and the app connect over TLS:
   `mysql://USER:PASSWORD@HOST:4000/talentflow?sslaccept=strict`
2. Create the tables once from your machine, pointing `DATABASE_URL` at the new database: `npx prisma db push`.
3. Import the GitHub repo on **Vercel** and set the environment variables: `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` set to the deployed `https://…vercel.app` URL (plus the `EMAIL_*` settings if you want email updates).
4. In Google Cloud Console, add `https://<your-app>.vercel.app/api/auth/callback/google` as an authorized redirect URI.

Database TLS options (see `src/lib/db-config.ts`):

| Variable | Purpose |
| --- | --- |
| `?sslaccept=strict` in `DATABASE_URL` or `DATABASE_SSL=true` | Connect over TLS, verifying the server certificate against the system CAs. |
| `DATABASE_SSL_CA` | PEM contents of a provider CA (e.g. Aiven's `ca.pem`); literal `\n` separators are accepted. |

Resumes are limited to 4 MB because Vercel caps request bodies at 4.5 MB.
