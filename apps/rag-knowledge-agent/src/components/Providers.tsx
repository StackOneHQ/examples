'use client'

import '@ant-design/v5-patch-for-react-19'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { App } from 'antd'
import ClientLayout from '@/components/ClientLayout'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <App>
          <ClientLayout>
            {children}
          </ClientLayout>
        </App>
      </ThemeProvider>
    </SessionProvider>
  )
}
