'use client'

import { ConfigProvider, theme } from 'antd'
import React, { ReactNode } from 'react'

// Create type-asserted component
const TypographyConfigProvider = ConfigProvider as any

// Suppress Ant Design React version compatibility warnings
const originalWarn = console.warn
console.warn = (...args) => {
  const warningMessage = args[0]
  if (typeof warningMessage === 'string' && 
      (warningMessage.includes('[antd: compatible]') || 
       warningMessage.includes('antd v5 support React') ||
       warningMessage.includes('React is 16 ~ 18') ||
       warningMessage.includes('antd v5 support React is 16 ~ 18') ||
       warningMessage.includes('see https://u.ant.design/v5-for-19') ||
       warningMessage.includes('antd v5 support React is 16 ~ 18. see https://u.ant.design/v5-for-19'))) {
    return
  }
  originalWarn.apply(console, args)
}

const antdTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // StackOne Brand Colors
    colorPrimary: '#505050',
    colorSuccess: '#505050',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#06b6d4',
    
    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    fontSize: 14,
    fontSizeHeading1: 40,
    fontSizeHeading2: 32,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 18,
    fontSizeHeading6: 16,
    
    // Border Radius
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    
    // Colors
    colorText: '#202020',
    colorTextSecondary: '#707070',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#fafafa',
    colorBorder: 'rgb(240, 240, 240)',
    colorBorderSecondary: 'rgb(240, 240, 240)',
    
    // Spacing
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    
    // Shadow
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    boxShadowSecondary: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  components: {
    Button: {
      borderRadius: 12,
      fontWeight: 500,
    },
    Card: {
      borderRadius: 12,
      borderColor: 'rgb(240, 240, 240)',
    },
    Input: {
      borderRadius: 12,
    },
    Layout: {
      bodyBg: '#fafafa',
      headerBg: '#ffffff',
    },
    Menu: {
      borderRadius: 12,
    },
  },
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <TypographyConfigProvider theme={antdTheme}>
      {children}
    </TypographyConfigProvider>
  )
}
