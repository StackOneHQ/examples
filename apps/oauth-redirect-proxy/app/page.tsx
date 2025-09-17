export default function Home() {
  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      maxWidth: '800px', 
      margin: '50px auto', 
      padding: '20px',
      lineHeight: '1.6'
    }}>
      <h1>OAuth Redirect Proxy</h1>
      
      <p>
        This is a simple OAuth redirect proxy that forwards OAuth callbacks to StackOne.
      </p>
      
      <h2>How to use:</h2>
      <ol>
        <li>Deploy this app to Vercel</li>
        <li>Configure your custom domain in Vercel (optional)</li>
        <li>Configure StackOne with <code>redirectUri</code> parameter pointing to your domain</li>
        <li>Use <code>https://yourdomain.com/connect/oauth2/&#123;provider&#125;/callback</code> as your OAuth redirect URI</li>
        <li>This proxy will automatically forward all OAuth callbacks to StackOne</li>
      </ol>
      
      <h2>OAuth Redirect Endpoint:</h2>
      <p>
        <strong>GET/POST</strong> <code>/connect/oauth2/&#123;provider&#125;/callback</code>
      </p>
      <p>
        This endpoint receives OAuth callbacks and forwards them to:
        <br />
        <code>https://api.stackone.com/connect/oauth2/&#123;provider&#125;/callback</code>
      </p>
      <p>
        <strong>GET requests:</strong> Redirects to StackOne with query parameters
        <br />
        <strong>POST requests:</strong> Forwards request body and headers to StackOne
      </p>
      
      <h2>Examples:</h2>
      <p>
        If your domain is <code>myapp.com</code>, configure your OAuth apps with:
        <br />
        <code>https://myapp.com/connect/oauth2/google/callback</code>
        <br />
        <code>https://myapp.com/connect/oauth2/microsoft/callback</code>
        <br />
        <code>https://myapp.com/connect/oauth2/slack/callback</code>
      </p>
      
      <p>
        When OAuth providers redirect to this URL, this proxy will automatically forward the request to StackOne with all the same query parameters.
      </p>
    </div>
  );
}
