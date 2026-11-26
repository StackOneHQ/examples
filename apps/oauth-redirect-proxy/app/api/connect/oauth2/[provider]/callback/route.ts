import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ provider: string }> };

// An OAuth form_post callback is a handful of short fields; anything larger is refused
// before it is buffered.
const MAX_BODY_BYTES = 64 * 1024;

async function readBodyWithinLimit(request: NextRequest): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handleOAuthCallback(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const { provider } = await params;
    const method = request.method;
    
    // Security: Encode provider to prevent path injection
    const encodedProvider = encodeURIComponent(provider);
    
    // Get all query parameters from the incoming request
    const searchParams = request.nextUrl.searchParams;
    
    // Get request body if it exists (for POST requests)
    let body: string | null = null;
    if (method === 'POST') {
      const received = await readBodyWithinLimit(request).catch((error) => {
        console.warn('Could not read request body:', error);
        return '';
      });
      if (received === null) {
        return new NextResponse('Payload too large', { status: 413 });
      }
      body = received;
    }
    
    // Log parameter names only: providers return codes and tokens under many names
    // (code, id_token, JARM "response"), so no value is safe to log.
    console.log('OAuth redirect received:', {
      provider: encodedProvider,
      method,
      searchParamKeys: Array.from(searchParams.keys()),
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
      // Forward only end-to-end headers from the incoming request
      const forwardHeaders: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        
        // Hop-by-hop headers, and this domain's own credentials, which StackOne must not get
        const skippedHeaders = [
          'host', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
          'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-length', 'content-encoding',
          'cookie', 'authorization'
        ];
        
        if (!skippedHeaders.includes(lowerKey)) {
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
  context: RouteContext
) {
  return handleOAuthCallback(request, context);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  return handleOAuthCallback(request, context);
}
