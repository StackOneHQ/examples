# Vercel Deployment Guide

This guide covers deploying the StackOne Knowledge Agent to Vercel.

## Prerequisites

- A [Vercel account](https://vercel.com)
- A [StackOne account](https://stackone.com) with Documents API access
- An [OpenAI API key](https://platform.openai.com/api-keys)
- A PostgreSQL database with pgvector extension (set up via Vercel Marketplace: Neon, Supabase, etc.)

## Step 1: Set Up PostgreSQL Database

Vercel doesn't provide a built-in Postgres database. You need to set up a database from the **Vercel Marketplace**. Popular options include **Neon** (recommended) and **Supabase**, both of which support pgvector.

### Option A: Neon PostgreSQL (Recommended)

Neon is available through the Vercel Marketplace and offers excellent pgvector support with a generous free tier.

1. **Create a Neon database via Vercel Marketplace:**
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to your project → "Storage" tab
   - Click "Browse Marketplace" or "Create Database"
   - Select **"Neon"** from the marketplace
   - Click "Create" and follow the setup wizard
   - Neon will automatically create a database and connection string
   - **Authentication is handled automatically** - the connection string includes all credentials (username, password, SSL) embedded in it
   - The `DATABASE_URL` environment variable is automatically injected into your Vercel project

2. **Enable pgvector extension:**
   - In your Neon dashboard (accessible from Vercel or directly at [neon.tech](https://neon.tech))
   - Go to the SQL Editor
   - Run the following commands:
     ```sql
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
     CREATE EXTENSION IF NOT EXISTS "vector";
     ```

3. **Run the database schema:**
   - Still in the SQL Editor, copy and paste the contents of `postgres-schema.sql`
   - Execute the SQL script to create all required tables

4. **Get your database connection string:**
   - **The connection string is automatically added** to your Vercel environment variables as `DATABASE_URL`
   - To verify: In Vercel → Your project → "Storage" → Your Neon database → ".env.local" tab
   - You should see `POSTGRES_URL` or `DATABASE_URL` already set
   - If you need to manually add it: Copy from Neon dashboard → "Connection Details" → Use the connection string as `DATABASE_URL`
   - **Note:** Neon's connection string already includes authentication credentials - no additional auth setup is needed

### Option B: Supabase PostgreSQL

Supabase is another popular option available through the Vercel Marketplace.

1. **Create a Supabase database via Vercel Marketplace:**
   - Go to your [Vercel Dashboard](https://vercel.com/dashboard)
   - Navigate to your project → "Storage" tab
   - Click "Browse Marketplace" or "Create Database"
   - Select **"Supabase"** from the marketplace
   - Click "Create" and follow the setup wizard
   - Supabase will automatically create a database and connection string

2. **Enable pgvector extension:**
   - In your Supabase dashboard (accessible from Vercel or directly at [supabase.com](https://supabase.com))
   - Go to the SQL Editor
   - Run the following commands:
     ```sql
     CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
     CREATE EXTENSION IF NOT EXISTS "vector";
     ```

3. **Run the database schema:**
   - Still in the SQL Editor, copy and paste the contents of `postgres-schema.sql`
   - Execute the SQL script to create all required tables

4. **Get your database connection string:**
   - In Vercel: Go to your project → "Storage" → Your Supabase database → ".env.local" tab
   - Copy the `POSTGRES_URL` value (this will be your `DATABASE_URL`)
   - Or in Supabase dashboard: Go to "Settings" → "Database" → Copy the connection string

### Other Marketplace Options

You can also use other PostgreSQL providers from the Vercel Marketplace (e.g., PlanetScale, Railway, etc.), as long as they support the `pgvector` extension. Follow the same steps:
1. Create the database via the marketplace
2. Enable the `uuid-ossp` and `vector` extensions
3. Run the schema from `postgres-schema.sql`
4. Get the connection string and use it as `DATABASE_URL`

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Import your repository:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select the `apps/rag-knowledge-agent` directory as the root directory

2. **Configure the project:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/rag-knowledge-agent`
   - **Build Command:** `cd ../.. && npm install && npm run build --filter=rag-knowledge-agent` (or use Turborepo)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `cd ../.. && npm install` (install from root for Turborepo)
   - **OR** for simpler setup, keep root directory as `apps/rag-knowledge-agent` and use:
     - **Build Command:** `npm run build` (default)
     - **Install Command:** `npm install` (default)

3. **Add Environment Variables:**
   Click "Environment Variables" and add the following:

   **Required Variables:**
   ```
   DATABASE_URL=<your-marketplace-database-connection-string>
   OPENAI_API_KEY=<your-openai-api-key>
   OPENAI_CHAT_MODEL=gpt-4o
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   OPENAI_EMBEDDING_DIMENSIONS=1536
   STACKONE_API_KEY=<your-stackone-api-key>
   NEXTAUTH_SECRET=<generate-a-random-secret-see-below>
   NEXTAUTH_URL=https://your-app.vercel.app
   APP_URL=https://your-app.vercel.app
   AVAILABLE_INTEGRATIONS=googledrive,googledocs,googlesheets,notion_documents
   ```

   **Optional Variables:**
   ```
   AGENT_MAX_TURNS=10
   STACKONE_WEBHOOK_SECRET=<your-webhook-secret>
   OPENAI_CLASSIFIER_MODEL=gpt-3.5-turbo
   AVAILABLE_INTEGRATION_VERSIONS=googledrive:1.0,googlesheets:1.0
   ```

   **For Google SSO (Optional):**
   ```
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   ```

   **Debug Variables (Optional, for development):**
   ```
   DEBUG=1
   DEBUG_CHAT=1
   DEBUG_TOOLS=1
   ```

4. **Generate NEXTAUTH_SECRET (Required):**
   
   **NEXTAUTH_SECRET is REQUIRED** - it's used to sign and encrypt JWT tokens for authentication. Generate it BEFORE deploying:
   
   ```bash
   openssl rand -base64 32
   ```
   
   Or use an online generator: https://generate-secret.vercel.app/32
   
   Copy the generated secret and set it as `NEXTAUTH_SECRET` in Vercel environment variables.

5. **Set NEXTAUTH_URL (Recommended):**
   
   **NEXTAUTH_URL is recommended** but can be auto-detected by NextAuth on Vercel if "Automatically expose System Environment Variables" is enabled in your Vercel project settings.
   
   **Before first deployment:**
   - You can use a placeholder: `https://your-app-name.vercel.app` (replace with your actual project name)
   - Or leave it unset if auto-detection is enabled
   
   **After first deployment:**
   - Update `NEXTAUTH_URL` to your actual Vercel URL: `https://your-actual-app.vercel.app`
   - Also update `APP_URL` to match
   - If using Google OAuth, update the redirect URI in Google Cloud Console to match

6. **Deploy:**
   - Click "Deploy"
   - Wait for the build to complete
   - Your app will be available at `https://your-app.vercel.app`
   - **After deployment:** Update `NEXTAUTH_URL` and `APP_URL` if you used placeholders

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Navigate to the project directory:**
   ```bash
   cd apps/rag-knowledge-agent
   ```

3. **Login to Vercel:**
   ```bash
   vercel login
   ```

4. **Link your project:**
   ```bash
   vercel link
   ```
   Follow the prompts to link to an existing project or create a new one.

5. **Set environment variables:**
   ```bash
   vercel env add DATABASE_URL
   vercel env add OPENAI_API_KEY
   vercel env add OPENAI_CHAT_MODEL
   vercel env add OPENAI_EMBEDDING_MODEL
   vercel env add OPENAI_EMBEDDING_DIMENSIONS
   vercel env add STACKONE_API_KEY
   vercel env add NEXTAUTH_SECRET
   vercel env add NEXTAUTH_URL
   vercel env add APP_URL
   vercel env add AVAILABLE_INTEGRATIONS
   ```
   For each variable, paste the value when prompted. Select "Production", "Preview", and "Development" environments as needed.

6. **Deploy:**
   ```bash
   vercel --prod
   ```

## Step 3: Configure StackOne Webhook

After deployment, configure the StackOne webhook to point to your Vercel deployment:

1. **Get your webhook URL:**
   ```
   https://your-app.vercel.app/api/stackone/webhook
   ```

2. **Configure in StackOne Dashboard:**
   - Go to your StackOne Dashboard
   - Navigate to "Webhooks"
   - Create a new webhook or edit an existing one
   - Set the URL to: `https://your-app.vercel.app/api/stackone/webhook`
   - Copy the webhook signing secret

3. **Add webhook secret to Vercel:**
   - In Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add `STACKONE_WEBHOOK_SECRET` with the value from StackOne

4. **Redeploy (if needed):**
   - If you added the webhook secret after initial deployment, trigger a new deployment:
     ```bash
     vercel --prod
     ```
   Or use the "Redeploy" button in the Vercel dashboard.

## Step 4: Configure Google OAuth (Optional)

If you want to enable Google SSO:

1. **Create OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Navigate to "APIs & Services" → "Credentials"
   - Create an OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URIs:
     - `https://your-app.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for local testing)

2. **Add to Vercel environment variables:**
   - `GOOGLE_CLIENT_ID=<your-client-id>`
   - `GOOGLE_CLIENT_SECRET=<your-client-secret>`

3. **Redeploy** to apply the changes.

## Step 5: Custom Domain (Optional)

To use your own domain:

1. **Add domain in Vercel:**
   - Go to your project → Settings → Domains
   - Add your custom domain
   - Follow the DNS configuration instructions

2. **Update environment variables:**
   - Update `NEXTAUTH_URL` to your custom domain
   - Update `APP_URL` to your custom domain
   - Update Google OAuth redirect URI (if using Google SSO)

3. **Redeploy** to apply the changes.

## Step 6: Verify Deployment

1. **Visit your deployed app:**
   ```
   https://your-app.vercel.app
   ```

2. **Test the application:**
   - Create an account or log in
   - Connect an integration (e.g., Google Drive)
   - Create an agent
   - Upload documents and test the chat functionality

3. **Check logs:**
   - In Vercel Dashboard → Your Project → Deployments → Click on a deployment → "Functions" tab
   - Check for any errors in the logs

## FAQ

### Do I need to enable Neon database authentication?

**No, authentication is handled automatically.** When you set up Neon through the Vercel Marketplace:

- Neon automatically creates a database user with secure credentials
- The connection string includes all authentication information (username, password, SSL settings)
- The `DATABASE_URL` environment variable is automatically injected into your Vercel project
- No additional authentication setup or configuration is required

The connection string format looks like:
```
postgres://username:password@host.neon.tech/dbname?sslmode=require
```

All credentials are embedded in the connection string, so your application code (using the standard `pg` library) will authenticate automatically.

## Troubleshooting

### Database Connection Issues

- **Verify DATABASE_URL:** Make sure the connection string from your marketplace database (Neon, Supabase, etc.) is correctly set
- **Check pgvector extension:** Ensure both `uuid-ossp` and `vector` extensions are enabled
- **Verify schema:** Confirm all tables were created by running `\dt` in the SQL Editor
- **Connection pooling:** Some providers (like Neon) use connection pooling by default. If you encounter connection issues, try using the pooled connection string or the direct connection string
- **SSL mode:** Some providers require SSL. Ensure your connection string includes `?sslmode=require` if needed

### Build Errors

- **Check Node.js version:** Vercel should auto-detect, but you can specify in `package.json`:
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```
- **Check build logs:** Review the build output in Vercel dashboard for specific errors
- **TypeScript errors:** The project has `ignoreBuildErrors: true` in `next.config.ts`, but check for runtime issues

### Environment Variables

- **Missing variables:** Ensure all required environment variables are set for Production, Preview, and Development environments
- **Incorrect values:** Double-check API keys and secrets are correct
- **Case sensitivity:** Environment variable names are case-sensitive

### Webhook Issues

- **Verify webhook URL:** Ensure the webhook URL in StackOne matches your Vercel deployment URL
- **Check signature verification:** Ensure `STACKONE_WEBHOOK_SECRET` is set correctly
- **Test webhook:** Use StackOne's webhook testing feature or check Vercel function logs

### NextAuth / Authentication Issues

- **NEXTAUTH_SECRET missing:** This is REQUIRED. Generate it with `openssl rand -base64 32` before deploying
- **NEXTAUTH_URL not set:** NextAuth can auto-detect on Vercel, but it's recommended to set it explicitly. Enable "Automatically expose System Environment Variables" in Vercel settings, or set `NEXTAUTH_URL` manually
- **OAuth callback 404 errors:** Ensure `NEXTAUTH_URL` is set correctly and matches your actual Vercel domain (no trailing slash)
- **Redirect URI mismatch:** Ensure the redirect URI in Google OAuth matches exactly: `https://your-app.vercel.app/api/auth/callback/google`
- **Credentials:** Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct

## Environment Variables Reference

### Required

| Variable | Description | How to Get It | Example |
|----------|-------------|---------------|---------|
| `DATABASE_URL` | PostgreSQL connection string from marketplace database (Neon, Supabase, etc.) | From Vercel Marketplace database dashboard | `postgres://user:pass@host:5432/db` |
| `OPENAI_API_KEY` | OpenAI API key | From [OpenAI Platform](https://platform.openai.com/api-keys) | `sk-...` |
| `OPENAI_CHAT_MODEL` | Model for chat responses | Choose from available models | `gpt-4o` |
| `OPENAI_EMBEDDING_MODEL` | Model for embeddings | Choose from available models | `text-embedding-3-small` |
| `OPENAI_EMBEDDING_DIMENSIONS` | Embedding dimensions | Must match your model | `1536` |
| `STACKONE_API_KEY` | StackOne API key | From [StackOne Dashboard](https://stackone.com) | `v1.uk1...` |
| `NEXTAUTH_SECRET` | **REQUIRED** - Secret for NextAuth.js JWT signing | **Generate BEFORE deployment:** `openssl rand -base64 32` | `abc123...` (64+ chars) |
| `NEXTAUTH_URL` | **Recommended** - Your app's public URL for OAuth callbacks | **Before deploy:** Use placeholder `https://your-app-name.vercel.app`<br>**After deploy:** Update to actual URL | `https://your-app.vercel.app` |
| `APP_URL` | Your app's public URL | Same as `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `AVAILABLE_INTEGRATIONS` | Comma-separated list of integrations | Configure based on your StackOne project | `googledrive,googledocs,googlesheets` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_MAX_TURNS` | Maximum agent turns | `10` |
| `STACKONE_WEBHOOK_SECRET` | Webhook signing secret | - |
| `OPENAI_CLASSIFIER_MODEL` | Model for classification | Uses chat model |
| `AVAILABLE_INTEGRATION_VERSIONS` | Provider versions | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | - |
| `DEBUG` | Enable debug logging | - |
| `DEBUG_CHAT` | Enable chat debug logging | - |
| `DEBUG_TOOLS` | Enable tool debug logging | - |

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Marketplace](https://vercel.com/marketplace)
- [Neon Documentation](https://neon.tech/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [StackOne Documentation](https://docs.stackone.com)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## Support

If you encounter issues:
1. Check the Vercel deployment logs
2. Review environment variables
3. Verify database schema is correctly applied
4. Check StackOne webhook configuration
5. Review the application logs in Vercel Functions tab
