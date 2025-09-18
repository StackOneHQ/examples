'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from './page.module.css'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // Redirect based on authentication status
      if (user) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }
    getUser()
  }, [supabase.auth, router])

  // Show loading while redirecting
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingText}>
        Loading...
      </div>
    </div>
  )
}