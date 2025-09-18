'use client'

import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import StackOneSidebar from './StackOneSidebar'
import styles from './ClientLayout.module.css'

// Create Supabase client outside component to prevent re-creation on every render
const supabase = createClient()

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (!mounted) return

        if (error) {
          // Only log non-session-missing errors
          if (!error.message.includes('Auth session missing')) {
            console.error('Auth error:', error)
          }
          setUser(null)
          // Redirect to login if not on login page
          if (pathname !== '/login') {
            router.push('/login')
          }
        } else {
          setUser(user)
        }
        setLoading(false)
      } catch (error) {
        if (!mounted) return
        
        // Only log non-session-missing errors
        if (error instanceof Error && !error.message.includes('Auth session missing')) {
          console.error('Error getting user:', error)
        }
        setUser(null)
        setLoading(false)
        // Redirect to login if not on login page
        if (pathname !== '/login') {
          router.push('/login')
        }
      }
    }

    getUser()

    // Listen for auth changes
    let subscription: any = null
    try {
      const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) return
          
          console.log('Auth state change:', event, session?.user?.email)
          
          // Update user state immediately
          setUser(session?.user ?? null)
          setLoading(false)
          
          // Handle logout - redirect to login with success message
          if (event === 'SIGNED_OUT') {
            console.log('SIGNED_OUT event detected, redirecting to login...')
            router.push('/login?message=You have been successfully logged out')
            return
          }
          
          // Handle login - redirect to dashboard if on login page
          if (event === 'SIGNED_IN' && pathname === '/login') {
            // Small delay to ensure state is updated before redirect
            setTimeout(() => {
              if (mounted) {
                router.push('/dashboard')
              }
            }, 100)
            return
          }
          
          // Handle token refresh - update user state
          if (event === 'TOKEN_REFRESHED') {
            setUser(session?.user ?? null)
            return
          }
        }
      )
      subscription = authSubscription
    } catch (error) {
      console.error('Error setting up auth listener:', error)
      setLoading(false)
    }

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [supabase.auth, router, pathname])

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading...</div>
      </div>
    )
  }

  // Check if we're on the login page
  const isLoginPage = pathname === '/login'

  return (
    <div className={styles.container}>
      {/* Show sidebar for all pages except login */}
      {!isLoginPage && user && (
        <StackOneSidebar
          user={user}
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}
      
      <main 
        className={`${styles.main} ${!isLoginPage && user ? styles.withSidebar : ''}`}
        style={{
          marginLeft: !isLoginPage && user ? (sidebarCollapsed ? '80px' : '280px') : '0px'
        }}
      >
        {children}
      </main>
    </div>
  )
}