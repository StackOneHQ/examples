import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/health (health check endpoint)
     * - api/stackone/connectors (public connector metadata)
     * - api/stackone/webhook (webhook endpoint)
     * - Static assets (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/health|api/stackone/connectors|api/stackone/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
