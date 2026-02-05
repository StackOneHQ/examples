'use server'

import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { queryOne, query } from '@/lib/db'

export async function signup(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string

  if (!email || !password) {
    redirect(`/login?message=Email and password are required${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''}`)
  }

  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
  if (existing) {
    redirect(`/login?message=An account with this email already exists${redirectTo ? `&redirectTo=${encodeURIComponent(redirectTo)}` : ''}`)
  }

  const password_hash = await hash(password, 12)
  await query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
    [email, password_hash]
  )

  const successUrl = redirectTo
    ? `/login?message=Account created. Sign in below.&redirectTo=${encodeURIComponent(redirectTo)}`
    : '/login?message=Account created. Sign in below.'
  redirect(successUrl)
}
