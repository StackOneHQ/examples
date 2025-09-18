import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Valid redirect paths - prevent open redirect attacks
const ALLOWED_REDIRECT_PATHS = ['/', '/dashboard', '/agents', '/integrations']

function isValidRedirectPath(path: string): boolean {
  return ALLOWED_REDIRECT_PATHS.includes(path) || path.startsWith('/agents/') || path.startsWith('/integrations')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  // Validate redirect path to prevent open redirect attacks
  const redirectPath = isValidRedirectPath(next) ? next : '/'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // redirect user to validated redirect URL or root of app
      redirect(redirectPath)
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/login?message=Could not authenticate user')
}
