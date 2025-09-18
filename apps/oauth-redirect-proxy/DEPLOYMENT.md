# Deployment Guide

This guide covers multiple deployment options for the OAuth Redirect Proxy. **Vercel is not required** - you can deploy to any Node.js hosting platform or using Docker.

## Option 1: Quick Deploy to Vercel (One-Click)

1. **Click the deploy button below:**
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FStackOneHQ%2Fexamples%2Ftree%2Fmain%2Fapps%2Foauth-redirect-proxy)

2. **Configure your custom domain (optional):**
   - After deployment, go to your Vercel dashboard
   - Select your project
   - Go to "Settings" → "Domains"
   - Add your custom domain
   - Follow the DNS configuration instructions

## Option 2: Docker Deployment

Deploy using Docker to any container hosting platform:

### Build and Run Locally

1. **Navigate to the project directory:**
   ```bash
   cd apps/oauth-redirect-proxy
   ```

2. **Option A: Using Docker Compose (recommended):**
   ```bash
   docker-compose up --build
   ```

3. **Option B: Using Docker directly:**
   ```bash
   # Build the Docker image
   docker build -t oauth-redirect-proxy .
   
   # Run locally
   docker run -p 3000:3000 oauth-redirect-proxy
   ```

### Deploy to Container Platforms

Deploy to any Docker-compatible platform:

- **[Railway](https://railway.app)** - Connect your GitHub repo
- **[Render](https://render.com)** - Deploy from GitHub with Docker support
- **[DigitalOcean App Platform](https://cloud.digitalocean.com/apps)** - Connect your repo
- **[Fly.io](https://fly.io)** - Deploy with `fly deploy`
- **[Google Cloud Run](https://cloud.google.com/run)** - Deploy containerized apps
- **[AWS ECS/Fargate](https://aws.amazon.com/ecs/)** - Run containers on AWS

## Option 3: Manual Deployment to Other Platforms

### Railway

1. **Fork this repository**
2. **Go to [Railway](https://railway.app)**
3. **Click "New Project"**
4. **Import your forked repository**
5. **Deploy!**

### Render

1. **Fork this repository**
2. **Go to [Render](https://render.com)**
3. **Click "New Web Service"**
4. **Connect your GitHub repository**
5. **Configure build settings:**
   - Build Command: `npm run build`
   - Start Command: `npm start`
6. **Deploy!**

### DigitalOcean App Platform

1. **Fork this repository**
2. **Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)**
3. **Click "Create App"**
4. **Connect your GitHub repository**
5. **Configure the app:**
   - Source: Your forked repository
   - Type: Web Service
   - Build Command: `npm run build`
   - Run Command: `npm start`
6. **Deploy!**

### Vercel CLI (Alternative to Web UI)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Navigate to the project directory:**
   ```bash
   cd apps/oauth-redirect-proxy
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Follow the prompts** to configure your deployment

## Using Your Deployed App

1. **Visit your deployed app** (e.g., `https://your-app.vercel.app`, `https://your-app.railway.app`, etc.)
2. **Construct your redirect URL** using the format: `https://yourdomain.com/connect/oauth2/{provider}/callback`
3. **Use this URL** as your OAuth redirect URI in your OAuth app configuration

## Example Usage

If your deployed app is at `https://your-app.vercel.app` and you want to use `yourdomain.com` as your domain:

1. **Construct the redirect URL**: `https://yourdomain.com/connect/oauth2/google/callback`
2. **Configure this URL** in your OAuth app settings
3. **When OAuth providers redirect** to this URL, it will automatically forward to StackOne

## Custom Domain Setup

To use your own domain instead of the platform's default subdomain:

### Vercel
1. **Add your domain in Vercel:**
   - Go to project settings
   - Add domain under "Domains" section
   - Follow DNS configuration instructions

### Railway
1. **Add your domain in Railway:**
   - Go to your project settings
   - Add custom domain under "Domains"
   - Follow DNS configuration instructions

### Render
1. **Add your domain in Render:**
   - Go to your service settings
   - Add custom domain
   - Follow DNS configuration instructions

### DigitalOcean App Platform
1. **Add your domain in DigitalOcean:**
   - Go to your app settings
   - Add custom domain
   - Follow DNS configuration instructions

2. **Update your OAuth app configuration:**
   - Use your custom domain in the redirect URL
   - Example: `https://yourdomain.com/connect/oauth2/google/callback`

## Troubleshooting

- **Domain not working?** Make sure DNS records are properly configured
- **OAuth not redirecting?** Check that your OAuth app is configured with the correct redirect URL
- **StackOne integration issues?** Verify that the redirect URL follows the correct format: `https://yourdomain.com/connect/oauth2/{provider}/callback`
