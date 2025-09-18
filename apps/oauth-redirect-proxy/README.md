# OAuth Redirect Proxy

A simple HTTP proxy that forwards OAuth redirects to StackOne. This solves the problem of needing a verified domain for OAuth app configurations by providing a hosted redirect endpoint.

> **📖 Project Overview**: This is part of the [StackOne Examples](../README.md) repository. See the main README for project structure and other examples.

## 📚 Documentation Navigation

- **[Main Project README](../README.md)** - Project overview and structure
- **[StackOne Integration Guide](./STACKONE_INTEGRATION.md)** - Detailed StackOne setup
- **[Deployment Guide](./DEPLOYMENT.md)** - Step-by-step deployment instructions

## Features

- 🚀 **One-click Vercel deployment**
- 🔗 **Custom domain support** - Works with any domain via Vercel
- 🔄 **Automatic StackOne forwarding** - Forwards OAuth callbacks to StackOne
- 📝 **Pure API proxy** - No frontend, no React, just HTTP request forwarding
- ⚡ **Ultra-lean** - Minimal dependencies, zero frontend overhead
- 🔄 **Complete header forwarding** - Passes through all headers and cookies
- 🔍 **Request logging** - Logs incoming requests for debugging

## How it works

1. Deploy this app to Vercel with your custom domain
2. Use `https://your-domain.com/connect/oauth2/{provider}/callback` as your OAuth redirect URI
3. When OAuth providers redirect to this URL, the app automatically forwards the request to StackOne's endpoint: `https://api.stackone.com/connect/oauth2/{provider}/callback`

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStackOneHQ%2Fexamples%2Ftree%2Fmain%2Fapps%2Foauth-redirect-proxy)

## Manual Deployment

1. **Fork this repository**
2. **Connect to Vercel:**
   - Go to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your forked repository
   - Deploy!

3. **Configure your custom domain:**
   - In Vercel dashboard, go to your project settings
   - Add your custom domain under "Domains"
   - Update DNS records as instructed

## Usage

1. **Deploy the app** to Vercel
2. **Configure your custom domain** in Vercel (optional)
3. **Configure StackOne** with the `redirectUri` parameter pointing to your domain
4. **Use the redirect URL** as your OAuth redirect URI in your OAuth app configuration

## Examples

If your domain is `yourdomain.com`, you can use either URL pattern:

**Provider-specific URLs:**
```
https://yourdomain.com/connect/oauth2/google/callback
https://yourdomain.com/connect/oauth2/microsoft/callback
https://yourdomain.com/connect/oauth2/slack/callback
```

**Generic URL (for testing or when provider is determined by StackOne):**
```
https://yourdomain.com/connect/oauth2/callback
```

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
  - GET requests: Redirects to StackOne with query parameters and forwards all cookies
  - POST requests: Forwards request body, all headers, and cookies to StackOne
  - Response: Forwards all response headers and cookies back to the client

- `GET/POST /connect/oauth2/callback` - Generic OAuth redirect handler (no provider specified)
  - Same functionality as above but forwards to StackOne's generic callback endpoint
  - Useful for testing or when provider is determined by StackOne