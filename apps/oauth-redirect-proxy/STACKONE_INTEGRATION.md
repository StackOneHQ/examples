# StackOne Integration Guide

This OAuth Redirect Proxy is specifically designed to work with [StackOne's OAuth Proxy Redirect](https://docs.stackone.com/integration-guides/oauth-proxy-redirect) flow.

## How it works

1. **OAuth providers** (like Google) require redirect URLs to be hosted on verified domains
2. **StackOne** needs to receive the OAuth callback to process the authentication
3. **This proxy** sits in between, satisfying both requirements:
   - Hosted on your verified domain (via Vercel)
   - Automatically forwards callbacks to StackOne

## Integration Flow

```
User → OAuth Provider → Your Domain/oauth2/{provider}/callback → StackOne
```

1. User initiates OAuth flow
2. OAuth provider redirects to `https://yourdomain.com/oauth2/{provider}/callback`
3. This proxy receives the callback with OAuth parameters
4. Proxy forwards the request to `https://api.stackone.com/connect/oauth2/{provider}/callback`
5. StackOne processes the authentication

## Configuration

### 1. Deploy this app to Vercel
- Use the one-click deploy button
- Or follow the manual deployment steps

### 2. Configure your custom domain (optional)
- Add your domain in Vercel dashboard
- Update DNS records as instructed

### 3. Generate your redirect URL
- Visit your deployed app
- Enter your domain
- Copy the generated redirect URL

### 4. Configure StackOne with custom redirect URI
- In your StackOne integration, set the `redirectUri` parameter to your custom URL
- This tells StackOne to use your domain for OAuth redirects instead of their default endpoint
- Example: Set `redirectUri` to `https://yourdomain.com/oauth2/google/callback`

### 5. Configure your OAuth app
- Use the same redirect URL in your OAuth app configuration
- Example: `https://yourdomain.com/oauth2/google/callback`

## Example Configuration

If your domain is `myapp.com` and your Vercel app is deployed there:

**OAuth App Settings:**
- Redirect URI: `https://yourdomain.com/oauth2/google/callback`
- Client ID: `your_oauth_client_id`
- Client Secret: `your_oauth_client_secret`

**StackOne Configuration:**
- Set the `redirectUri` parameter in your StackOne integration
- This parameter tells StackOne to redirect OAuth callbacks to your domain instead of their default endpoint
- The proxy automatically forwards these callbacks back to StackOne

## StackOne redirectUri Configuration

According to the [StackOne OAuth Proxy Redirect documentation](https://docs.stackone.com/integration-guides/oauth-proxy-redirect), you need to configure the `redirectUri` parameter in your StackOne integration:

### Why this is needed:
- **Google's requirement**: OAuth redirect URLs must be hosted on verified domains
- **StackOne's need**: They need to receive the OAuth callback to process authentication
- **Solution**: Use your custom domain as the redirect URI, which then forwards to StackOne

### How to configure:
1. **In your StackOne integration settings**, find the `redirectUri` parameter
2. **Set it to your custom domain URL**: `https://yourdomain.com/oauth2/{provider}/callback`
3. **StackOne will now redirect OAuth flows to your domain** instead of their default endpoint
4. **Your proxy automatically forwards** the callback back to StackOne's endpoint

### Example StackOne Configuration:
```javascript
// In your StackOne integration setup
{
  redirectUri: "https://yourdomain.com/oauth2/google/callback"
}
```

This creates the complete flow:
1. User initiates OAuth → Google
2. Google redirects to → `https://yourdomain.com/oauth2/google/callback` (your domain)
3. Your proxy forwards to → `https://api.stackone.com/connect/oauth2/google/callback` (StackOne)
4. StackOne processes the authentication

## Testing

### GET Request Testing
You can test the redirect functionality by visiting:
```
https://yourdomain.com/oauth2/google/callback?code=test&state=test
```

This should redirect you to:
```
https://api.stackone.com/connect/oauth2/google/callback?code=test&state=test
```

### POST Request Testing
You can also test POST requests with body data:
```bash
curl -X POST https://yourdomain.com/oauth2/google/callback \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=test&state=test"
```

This will forward the POST request body to StackOne's endpoint.

## Troubleshooting

- **Domain not verified?** Make sure your domain is properly configured in Vercel
- **OAuth not working?** Check that your OAuth app is configured with the exact redirect URL
- **StackOne integration issues?** 
  - Verify the `redirectUri` parameter is set correctly in StackOne
  - Ensure the redirect URL matches exactly what was generated
  - Check that StackOne is configured to use your custom domain instead of their default endpoint
- **Redirect not forwarding?** Check the Vercel function logs for any errors in the proxy

## Security Notes

- This proxy only forwards OAuth parameters
- No sensitive data is stored or logged
- All parameters are passed through unchanged
- The proxy is stateless and doesn't maintain sessions
