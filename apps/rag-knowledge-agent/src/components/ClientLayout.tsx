'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import StackOneSidebar from './StackOneSidebar'
import styles from './ClientLayout.module.css'

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const { data: session, status } = useSession()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()
  const user = session?.user
    ? { id: session.user.id!, email: session.user.email ?? null, name: session.user.name ?? null }
    : null
  const loading = status === 'loading'

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div>Loading...</div>
      </div>
    )
  }

  const isLoginPage = pathname === '/login'

  return (
    <div className={styles.container}>
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
          marginLeft: !isLoginPage && user ? (sidebarCollapsed ? '80px' : '280px') : '0px',
        }}
      >
        {children}
      </main>
    </div>
  )
}
