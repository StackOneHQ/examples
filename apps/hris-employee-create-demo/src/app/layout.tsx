import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'antd/dist/reset.css'
import { App } from 'antd'
import LoadingProvider from '@/components/LoadingProvider'
import { suppressAntdWarnings } from '@/lib/suppress-warnings'

// Suppress Ant Design compatibility warnings
suppressAntdWarnings();

const inter = Inter({ 
  subsets: ['latin'],
  display: 'block',
  variable: '--font-inter',
  preload: true
})

export const metadata: Metadata = {
  title: 'HRIS Demo',
  description: 'Demo showcasing StackOne HRIS integration capabilities',
  icons: {
    icon: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
              background-color: #fafafa;
              color: #202020;
              line-height: 1.5;
            }
            .ant-card {
              background: #ffffff;
              border: 1px solid #f0f0f0;
              border-radius: 12px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            .ant-btn {
              border-radius: 6px;
              font-weight: 500;
            }
            .ant-typography {
              color: #202020;
            }
            .ant-typography.ant-typography-secondary {
              color: #707070;
            }
          `
        }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <LoadingProvider>
          <App>
            {children}
          </App>
        </LoadingProvider>
      </body>
    </html>
  )
}
