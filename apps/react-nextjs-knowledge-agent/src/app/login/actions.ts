'use server'

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {

  const supabase = await createClient()

  // type-cast since the values come from a formData
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const redirectTo = formData.get('redirectTo') as string

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    const errorUrl = redirectTo 
      ? `/login?message=Could not authenticate user&redirectTo=${encodeURIComponent(redirectTo)}`
      : '/login?message=Could not authenticate user'
    redirect(errorUrl)
  }

  // Redirect to the original destination or default to dashboard
  const destination = redirectTo || '/dashboard'
  redirect(destination)
}

export async function signup(formData: FormData) {
  
  const supabase = await createClient()

  // type-cast since the values come from a formData
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const redirectTo = formData.get('redirectTo') as string

  const { data: signupData, error } = await supabase.auth.signUp(data)

  if (error) {
    console.error('Signup error:', error)
    const errorUrl = redirectTo 
      ? `/login?message=${encodeURIComponent(error.message)}&redirectTo=${encodeURIComponent(redirectTo)}`
      : `/login?message=${encodeURIComponent(error.message)}`
    redirect(errorUrl)
  }

  // Check if user needs email confirmation
  if (signupData.user && !signupData.user.email_confirmed_at) {
    const successUrl = redirectTo 
      ? `/login?message=Check your email to confirm your account&redirectTo=${encodeURIComponent(redirectTo)}`
      : '/login?message=Check your email to confirm your account'
    redirect(successUrl)
  } else {
    // User is confirmed, redirect to dashboard
    const destination = redirectTo || '/dashboard'
    redirect(destination)
  }
}
