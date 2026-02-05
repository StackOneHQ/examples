# Security Checklist

This document outlines security best practices for this application.

## ✅ Security Status

### Environment Variables
- ✅ `.env.local` is properly excluded via `.gitignore`
- ✅ All secrets are read from `process.env`, never hardcoded
- ✅ `env.example` contains only placeholder values
- ✅ No real API keys or secrets are committed to the repository

### Code Security
- ✅ All API keys are read from environment variables
- ✅ No hardcoded credentials in source code
- ✅ Database connection strings use environment variables
- ✅ Authentication secrets (NEXTAUTH_SECRET) are environment-based

### Files to Never Commit
The following files are excluded via `.gitignore`:
- `.env.local` and all `.env*.local` files
- `node_modules/`
- `.next/` build directory
- `*.tsbuildinfo`
- `.vercel/` directory

### Docker Configuration
- ⚠️ `docker-compose.yml` contains default PostgreSQL credentials (`postgres:postgres`)
  - This is acceptable for local development only
  - **Never use these credentials in production**
  - Production deployments should use secure database credentials from environment variables

## 🔒 Security Best Practices

### Before Committing
1. **Never commit `.env.local`** - Always verify it's in `.gitignore`
2. **Check for hardcoded secrets** - Search for patterns like:
   - `sk-` (OpenAI API keys)
   - `v1.uk1` (StackOne API keys)
   - `GOCSPX-` (Google OAuth secrets)
   - `eyJ` (JWT tokens)
   - Database connection strings with passwords
3. **Review all environment variable references** - Ensure they use `process.env.*`
4. **Check for accidentally committed secrets** - Use `git log` to verify

### Environment Variables Required
All sensitive values must be set via environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `STACKONE_API_KEY` - StackOne API key
- `NEXTAUTH_SECRET` - NextAuth.js secret (generate with `openssl rand -base64 32`)
- `STACKONE_WEBHOOK_SECRET` - Webhook signing secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth (optional)

### Production Deployment
When deploying to production (e.g., Vercel):
1. Set all environment variables in the hosting platform's dashboard
2. Never commit production secrets to the repository
3. Use different secrets for development and production
4. Rotate secrets regularly
5. Use secure database credentials (not default `postgres:postgres`)

## 🚨 If Secrets Are Accidentally Committed

If you accidentally commit secrets:

1. **Immediately rotate the exposed secrets**:
   - Regenerate OpenAI API key
   - Regenerate StackOne API key
   - Regenerate NEXTAUTH_SECRET
   - Regenerate any other exposed credentials

2. **Remove from git history**:
   ```bash
   # Remove file from git history (use with caution)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch apps/rag-knowledge-agent/.env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push** (coordinate with team):
   ```bash
   git push origin --force --all
   ```

4. **Consider using git-secrets or similar tools** to prevent future commits

## 📝 Additional Security Notes

- The application uses NextAuth.js for authentication - ensure `NEXTAUTH_SECRET` is strong and unique
- Database credentials in `docker-compose.yml` are for local development only
- All API calls use environment-based authentication
- Webhook endpoints verify signatures when `STACKONE_WEBHOOK_SECRET` is set
