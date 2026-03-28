# POURSONA — DIY SETUP GUIDE
# From zero to live in one weekend

## WHAT YOU NEED BEFORE YOU START
- A computer (Mac or Windows)
- An email address
- A credit card (for Anthropic API — very low cost, ~$5/month at launch volume)
- About 3–4 hours for first-time setup

---

## STEP 1 — INSTALL CURSOR (Your AI Code Editor)
1. Go to https://cursor.com
2. Click Download → install like any app
3. Open Cursor — it looks like a code editor with a chat panel on the right
4. Sign in with your email

> Cursor is where you'll paste all these files and run commands.
> When something breaks, you describe the problem in the chat and it fixes it.

---

## STEP 2 — INSTALL NODE.JS
1. Go to https://nodejs.org
2. Download the LTS version (the recommended one)
3. Install it — just click through the installer

Verify it worked: open Cursor → View → Terminal → type:
```
node --version
```
You should see something like v20.x.x

---

## STEP 3 — CREATE YOUR PROJECT
In the Cursor terminal, run these commands one at a time:

```bash
# Navigate to your Desktop (or wherever you want the project)
cd ~/Desktop

# Create the Next.js project
npx create-next-app@latest poursona --typescript --no-tailwind --no-src-dir --app --import-alias "@/*"

# Go into the project folder
cd poursona

# Install all dependencies
npm install @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr qrcode stripe resend uuid
npm install --save-dev @types/qrcode @types/uuid
```

---

## STEP 4 — COPY THE PROJECT FILES
1. Open the poursona folder in Cursor: File → Open Folder → select Desktop/poursona
2. In the file explorer on the left, you'll see the folder structure
3. Copy each file from the Poursona download into the matching location:

```
FROM DOWNLOAD → INTO YOUR PROJECT
─────────────────────────────────────────────────────
supabase/schema.sql        → poursona/supabase/schema.sql  (create supabase folder)
lib/supabase.ts            → poursona/lib/supabase.ts       (replace existing)
lib/prompts.ts             → poursona/lib/prompts.ts
app/api/chat/route.ts      → poursona/app/api/chat/route.ts (create folders)
app/api/catalog/route.ts   → poursona/app/api/catalog/route.ts
app/api/order/route.ts     → poursona/app/api/order/route.ts
app/api/qr/route.ts        → poursona/app/api/qr/route.ts
app/r/[slug]/page.tsx      → poursona/app/r/[slug]/page.tsx (create folders)
app/layout.tsx             → poursona/app/layout.tsx        (replace existing)
next.config.js             → poursona/next.config.js        (replace existing)
```

---

## STEP 5 — SUPABASE (Your Database)
1. Go to https://supabase.com → Sign up free
2. Click "New Project" → name it "poursona" → choose a region → set a password (save this!)
3. Wait ~2 minutes for it to spin up
4. Go to SQL Editor (left sidebar) → click "New Query"
5. Open supabase/schema.sql from your project
6. Copy ALL the contents → paste into Supabase SQL editor → click RUN
7. You should see "Success. No rows returned"

Get your keys:
- Go to Settings → API
- Copy: Project URL, anon public key, service_role key (keep this secret!)

---

## STEP 6 — ANTHROPIC API KEY
1. Go to https://console.anthropic.com
2. Sign up → go to API Keys → Create Key
3. Copy the key (starts with sk-ant-)
4. Add $10 credit to your account to start

---

## STEP 7 — ENVIRONMENT VARIABLES
1. In your poursona project folder, create a file called `.env.local`
   (Cursor: File → New File → name it .env.local)
2. Paste this and fill in your values:

```
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_SECRET=any-random-string-here
```

---

## STEP 8 — TEST LOCALLY
In the Cursor terminal:
```bash
npm run dev
```

Open your browser → go to http://localhost:3000

To test the customer experience:
1. Go to Supabase → Table Editor → retailers
2. Click Insert Row → add a test retailer:
   - name: "Test Coffee"
   - slug: "test-coffee"
   - vertical: "coffee"
   - location: "Your City"
   - owner_email: "your@email.com"
3. Go to products table → add a few products with retailer_id matching your retailer
4. Open http://localhost:3000/r/test-coffee

You should see the Poursona welcome screen!

---

## STEP 9 — GITHUB (Save Your Work)
1. Go to https://github.com → sign up free
2. Click "+" → New Repository → name it "poursona" → Private → Create
3. In Cursor terminal:
```bash
git init
git add .
git commit -m "Initial Poursona setup"
git remote add origin https://github.com/YOUR_USERNAME/poursona.git
git push -u origin main
```

---

## STEP 10 — DEPLOY TO VERCEL (Go Live)
1. Go to https://vercel.com → sign up with GitHub
2. Click "Add New Project" → Import your poursona repository
3. Before deploying, add your environment variables:
   - Click "Environment Variables"
   - Add each variable from your .env.local file
   - Change NEXT_PUBLIC_APP_URL to https://your-project.vercel.app
4. Click Deploy → wait ~2 minutes
5. Your app is live at https://poursona-xxx.vercel.app

---

## STEP 11 — CUSTOM DOMAIN (Optional, ~$10/year)
1. Go to https://cloudflare.com → sign up → buy your domain
2. In Vercel: Settings → Domains → Add Domain → enter your domain
3. Follow Vercel's instructions to update DNS in Cloudflare
4. Update NEXT_PUBLIC_APP_URL in Vercel environment variables to your real domain
5. Redeploy

---

## ADDING A RETAILER
Currently done via Supabase table editor. Admin dashboard coming next.

1. Supabase → Table Editor → retailers → Insert Row
2. Fill in: name, slug (URL-safe, no spaces), vertical, location, tagline, owner_email
3. Add their products to the products table with the retailer_id
4. Their QR scan URL is: https://your-domain.com/r/[slug]
5. Generate QR: https://your-domain.com/api/qr?slug=[slug]&format=png

---

## WHEN THINGS BREAK
1. Copy the error message
2. Paste it into Cursor's chat panel
3. Describe what you were trying to do
4. It will tell you exactly what to fix

Common fixes:
- "Cannot find module" → run npm install in terminal
- "Missing env variable" → check .env.local has all keys
- Supabase errors → check your service role key is correct
- Vercel deploy fails → check environment variables are all set

---

## NEXT STEPS (When Ready)
1. Build the admin dashboard as a protected /admin route
2. Add Stripe for retailer subscriptions
3. Add email receipts with Resend
4. Connect Square or Shopify for POS order routing
5. Add analytics dashboard

All of these can be built step by step in Cursor with Claude's help.
