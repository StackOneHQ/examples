import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

async function handleOAuthCallback(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const { provider } = params;
    const method = request.method;
    
    // Security: Encode provider to prevent path injection
    const encodedProvider = encodeURIComponent(provider);
    
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
    console.log('OAuth redirect received:', {
      provider: encodedProvider,
      method,
      searchParams: sanitizedParams,
      bodyLength: body ? body.length : 0,
      userAgent: request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      timestamp: new Date().toISOString()
    });
    
    // Build the redirect URL to StackOne with the encoded provider and all original query parameters
    const stackoneUrl = new URL(`https://api.stackone.com/connect/oauth2/${encodedProvider}/callback`);
    
    // Copy all query parameters to the StackOne URL
    searchParams.forEach((value, key) => {
      stackoneUrl.searchParams.set(key, value);
    });

    // Security: Log only non-sensitive info
    console.log('Redirecting to StackOne for provider:', encodedProvider);

    // For GET requests, redirect to StackOne
    if (method === 'GET') {
      return NextResponse.redirect(stackoneUrl.toString());
    }
    
    // For POST requests, forward the request to StackOne
    if (method === 'POST') {
      const response = await fetch(stackoneUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
          'User-Agent': request.headers.get('user-agent') || 'OAuth-Redirect-Proxy',
        },
        body: body || undefined,
        redirect: 'manual', // Security: Disable auto-follow redirects to preserve upstream semantics
      });
      
      // Forward the response from StackOne
      const responseBody = await response.text();
      
      // Security: Forward all upstream response headers
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });
      
      return new NextResponse(responseBody, {
        status: response.status,
        headers: responseHeaders,
      });
    }
    
    // For other methods, return method not allowed
    return new NextResponse('Method not allowed', { status: 405 });
    
  } catch (error) {
    console.error('OAuth redirect error:', error);
    
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

export async function GET(
  request: NextRequest,
  context: { params: { provider: string } }
) {
  return handleOAuthCallback(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: { provider: string } }
) {
  return handleOAuthCallback(request, context);
}
