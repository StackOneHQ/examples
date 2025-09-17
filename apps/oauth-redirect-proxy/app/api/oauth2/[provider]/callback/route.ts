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
    
    // Log the incoming request for debugging
    console.log('OAuth redirect received:', {
      provider,
      method,
      url: request.url,
      searchParams: Object.fromEntries(searchParams.entries()),
      body: body ? body.substring(0, 200) + (body.length > 200 ? '...' : '') : null,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer')
    });
    
    // Build the redirect URL to StackOne with the provider and all original query parameters
    const stackoneUrl = new URL(`https://api.stackone.com/connect/oauth2/${provider}/callback`);
    
    // Copy all query parameters to the StackOne URL
    searchParams.forEach((value, key) => {
      stackoneUrl.searchParams.set(key, value);
    });

    console.log('Redirecting to StackOne:', stackoneUrl.toString());

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
      });
      
      // Forward the response from StackOne
      const responseBody = await response.text();
      
      return new NextResponse(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('content-type') || 'text/plain',
        },
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
