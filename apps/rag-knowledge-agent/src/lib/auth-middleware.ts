import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const publicPaths = [
  '/login',
  '/auth',
  '/api/health',
  '/api/stackone/connectors',
  '/api/stackone/webhook',
]

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (isPublic) {
    return NextResponse.next()
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}
