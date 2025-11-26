# OAuth Redirect Proxy

A simple HTTP proxy that forwards OAuth redirects to StackOne. This solves the problem of needing a verified domain for OAuth app configurations by providing a hosted redirect endpoint.

> **📖 Project Overview**: This is part of the [StackOne Examples](../README.md) repository. See the main README for project structure and other examples.

## 📚 Documentation Navigation

- **[Main Project README](../README.md)** - Project overview and structure
- **[StackOne Integration Guide](./STACKONE_INTEGRATION.md)** - Detailed StackOne setup
- **[Deployment Guide](./DEPLOYMENT.md)** - Step-by-step deployment instructions

## Features

- 🚀 **Multiple deployment options** - Deploy to Vercel, Docker, or any Node.js hosting platform
- 🔗 **Custom domain support** - Works with any domain
- 🔄 **Automatic StackOne forwarding** - Forwards OAuth callbacks to StackOne
- 📝 **Pure API proxy** - No frontend, no React, just HTTP request forwarding
- ⚡ **Ultra-lean** - Minimal dependencies, zero frontend overhead
- 🔄 **Complete header forwarding** - Passes through all headers and cookies
- 🔍 **Request logging** - Logs incoming requests for debugging

## How it works

1. Deploy this app to any hosting platform (Vercel, Docker, Railway, etc.) with your custom domain
2. Use `https://your-domain.com/connect/oauth2/{provider}/callback` as your OAuth redirect URI
3. When OAuth providers redirect to this URL, the app automatically forwards the request to StackOne's endpoint: `https://api.stackone.com/connect/oauth2/{provider}/callback`

## Deployment Options

### Option 1: Quick Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStackOneHQ%2Fexamples%2Ftree%2Fmain%2Fapps%2Foauth-redirect-proxy)

### Option 2: Docker Deployment

Deploy using Docker to any container hosting platform:

```bash
# Build and run with Docker Compose (recommended for local development)
docker-compose up --build

# Or build and run manually
docker build -t oauth-redirect-proxy .
docker run -p 3000:3000 oauth-redirect-proxy

# Deploy to any Docker-compatible platform (Railway, Render, DigitalOcean, etc.)
```

### Option 3: Manual Deployment

1. **Fork this repository**
2. **Deploy to your preferred platform:**
   - **Vercel**: Go to [Vercel](https://vercel.com), click "New Project", import your repository
   - **Railway**: Connect your GitHub repo at [Railway](https://railway.app)
   - **Render**: Deploy from GitHub at [Render](https://render.com)
   - **DigitalOcean App Platform**: Connect your repo at [DigitalOcean](https://cloud.digitalocean.com/apps)

3. **Configure your custom domain:**
   - Add your custom domain in your platform's dashboard
   - Update DNS records as instructed

## Usage

1. **Deploy the app** to your chosen platform (Vercel, Docker, Railway, etc.)
2. **Configure your custom domain** (optional)
3. **Configure StackOne** with the `redirectUri` parameter pointing to your domain
4. **Use the redirect URL** as your OAuth redirect URI in your OAuth app configuration

## Examples

If your domain is `yourdomain.com`, use the provider-specific URL pattern:

As an example, for the Google Drive integration this will be `https://yourdomain.com/connect/oauth2/googledrive/callback`.

These URLs will automatically forward all OAuth callbacks to StackOne's endpoint while satisfying OAuth provider requirements for domain verification.

## StackOne Integration

This app is specifically designed to work with [StackOne's OAuth Proxy Redirect](https://docs.stackone.com/integration-guides/oauth-proxy-redirect) flow. It automatically forwards all OAuth callbacks to `https://api.stackone.com/connect/oauth2/{provider}/callback` with all original query parameters preserved.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## API Endpoints

- `GET/POST /connect/oauth2/{provider}/callback` - Provider-specific OAuth redirect handler
  - GET requests: Redirects to StackOne with query parameters (cookies are automatically included by the browser)
  - POST requests: Forwards request body and end-to-end headers to StackOne
  - Response: Forwards end-to-end response headers and cookies back to the client