import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@llamaindex/chat-ui/styles/markdown.css'
import '@llamaindex/chat-ui/styles/pdf.css'
import '@llamaindex/chat-ui/styles/editor.css'
import '@/lib/suppress-antd-warnings'
import { ThemeProvider } from '@/components/ThemeProvider'
import { App } from 'antd'
import ClientLayout from '@/components/ClientLayout'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'StackOne Knowledge Agent',
  description: 'AI-powered knowledge retrieval powered by StackOne',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/stackone-favicon.ico', type: 'image/x-icon' }
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof console !== 'undefined') {
                  const originalWarn = console.warn;
                  console.warn = function(...args) {
                    const warningMessage = args[0];
                    if (typeof warningMessage === 'string' && 
                        (warningMessage.includes('[antd: compatible]') || 
                         warningMessage.includes('antd v5 support React') ||
                         warningMessage.includes('React is 16 ~ 18') ||
                         warningMessage.includes('antd v5 support React is 16 ~ 18') ||
                         warningMessage.includes('see https://u.ant.design/v5-for-19') ||
                         warningMessage.includes('antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19'))) {
                      return;
                    }
                    originalWarn.apply(console, args);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          <App>
            <ClientLayout>
              {children}
            </ClientLayout>
          </App>
        </ThemeProvider>
      </body>
    </html>
  )
}
