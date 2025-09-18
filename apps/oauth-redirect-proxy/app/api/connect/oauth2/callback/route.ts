import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

async function handleGenericOAuthCallback(request: NextRequest) {
  try {
    const method = request.method;
    
    // Get all query parameters from the incoming request
    const searchParams = request.nextUrl.searchParams;
    
    // Get request body if it exists (for POST requests)
    let body: string | null = null;
    if (method === 'POST') {
      try {
        body = await request.text();
      } catch (error) {
        console.warn('Could not read request body:', error);
      }
    }
    
    // Security: Create sanitized log data (redact sensitive parameters)
    const sanitizedParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      // Redact sensitive OAuth parameters
      if (key === 'code' || key === 'state' || key === 'access_token' || key === 'refresh_token') {
        sanitizedParams[key] = '[REDACTED]';
      } else {
        sanitizedParams[key] = value;
      }
    });
    
    // Log the incoming request for debugging (sanitized)
    console.log('=== GENERIC OAUTH REDIRECT START ===');
    console.log('Generic OAuth redirect received:', {
      method,
      searchParams: sanitizedParams,
      bodyLength: body ? body.length : 0,
      userAgent: request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      timestamp: new Date().toISOString(),
      url: request.url
    });
    console.log('=== GENERIC OAUTH REDIRECT END ===');
    
    // Build the redirect URL to StackOne with all original query parameters
    // Note: This route doesn't specify a provider, so we'll use a generic callback
    const stackoneUrl = new URL('https://api.stackone.com/connect/oauth2/callback');
    
    // Copy all query parameters to the StackOne URL
    searchParams.forEach((value, key) => {
      stackoneUrl.searchParams.set(key, value);
    });

    // Security: Log only non-sensitive info
    console.log('=== REDIRECT INFO ===');
    console.log('Redirecting to StackOne generic callback');
    console.log('StackOne URL:', stackoneUrl.toString());
    console.log('=== REDIRECT INFO END ===');

    // For GET requests, redirect to StackOne
    if (method === 'GET') {
      return NextResponse.redirect(stackoneUrl.toString());
    }
    
    // For POST requests, forward the request to StackOne
    if (method === 'POST') {
      // Forward only end-to-end headers from the incoming request
      const forwardHeaders: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        
        // Skip hop-by-hop headers that should not be forwarded
        const hopByHopHeaders = [
          'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
          'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-length', 'content-encoding'
        ];
        
        if (!hopByHopHeaders.includes(lowerKey)) {
          forwardHeaders[key] = value;
        }
      });
      
      const response = await fetch(stackoneUrl.toString(), {
        method: 'POST',
        headers: forwardHeaders,
        body: body || undefined,
        redirect: 'manual', // Security: Disable auto-follow redirects to preserve upstream semantics
      });
      
      // Forward the response from StackOne
      const responseBody = await response.text();
      
      // Forward only end-to-end headers from upstream response
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        
        // Skip hop-by-hop headers and content headers after response.text()
        const hopByHopHeaders = [
          'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
          'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-length', 
          'content-encoding', 'content-type'
        ];
        
        if (hopByHopHeaders.includes(lowerKey)) {
          return;
        }
        
        // For Set-Cookie headers, we need to append each one individually
        if (lowerKey === 'set-cookie') {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      });
      
      return new NextResponse(responseBody, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    
    // For other methods, return method not allowed
    return new NextResponse('Method not allowed', { status: 405 });
    
  } catch (error) {
    console.error('Generic OAuth redirect error:', error);
    
    // Return a simple error response
    return new NextResponse(
      'OAuth Redirect Error: There was an error processing the OAuth redirect.',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleGenericOAuthCallback(request);
}

export async function POST(request: NextRequest) {
  return handleGenericOAuthCallback(request);
}
