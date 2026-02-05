import { type NextRequest } from 'next/server'
import { redirect } from 'next/navigation'

/**
 * Legacy auth confirm (e.g. magic link). With credentials provider we don't use OTP.
 * Redirect to login with a message.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const next = searchParams.get('next') ?? '/'
  redirect(`/login?message=Please sign in with your email and password&next=${encodeURIComponent(next)}`)
}
