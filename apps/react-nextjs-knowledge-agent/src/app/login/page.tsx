'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Form, Input, Button, Typography, Card, Divider, Alert, Space, App } from 'antd'
import { MailOutlined, LockOutlined, GoogleOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import Logo from '@/components/Logo'

// Type assertions for Ant Design components to fix React type conflicts
const AntdComponents = { Form, Input, Button, Card, Divider, Alert, Space, App } as any
const MailOutlinedIcon = MailOutlined as any
const LockOutlinedIcon = LockOutlined as any
const GoogleOutlinedIcon = GoogleOutlined as any
const EyeInvisibleOutlinedIcon = EyeInvisibleOutlined as any
const EyeTwoToneIcon = EyeTwoTone as any

// Create type-asserted components
const TypographyCard = Card as any
const TypographyForm = Form as any
const TypographyFormItem = Form.Item as any
const TypographyInput = Input as any
const TypographyInputPassword = Input.Password as any
const TypographyAlert = Alert as any
const TypographyButton = Button as any
const TypographyDivider = Divider as any
const TypographyLink = Typography.Link as any
import { login, signup } from './actions'
import { logger } from '@/utils/logger'
import styles from './LoginPage.module.css'
import {
  handleSubmitButtonMouseEnter,
  handleSubmitButtonMouseLeave,
  handleGoogleButtonMouseEnter,
  handleGoogleButtonMouseLeave,
  handleFooterLinkMouseEnter,
  handleFooterLinkMouseLeave,
  handleAdditionalLinkMouseEnter,
  handleAdditionalLinkMouseLeave
} from './loginUtils'

const TypographyTitle = Typography.Title as any
const TypographyText = Typography.Text as any

export default function LoginPage() {
  const { message } = AntdComponents.App.useApp()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [isSignupMode, setIsSignupMode] = useState(false)
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false)
  const searchParams = useSearchParams()
  const messageParam = searchParams.get('message')
  const redirectTo = searchParams.get('redirectTo')
  const router = useRouter()
  const supabase = createClient()

  // Helper function to determine message type
  const getMessageType = (message: string) => {
    const successKeywords = ['Check your email', 'success', 'confirmed', 'welcome', 'logged out']
    return successKeywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase())) ? 'success' : 'error'
  }

  // Check if user is already authenticated and redirect appropriately
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Use replace instead of push to avoid history issues
          const destination = redirectTo || '/dashboard'
          router.replace(destination)
        }
      } catch (error) {
        // Only log non-session-missing errors
        if (error instanceof Error && !error.message.includes('Auth session missing')) {
          console.error('Auth check error:', error)
        }
      }
    }
    
    checkAuth()
  }, [router, redirectTo, supabase.auth])

  // Switch to sign-in mode when there's a success message from signup
  useEffect(() => {
    if (messageParam && getMessageType(messageParam) === 'success') {
      setIsSignupMode(false)
      setIsForgotPasswordMode(false)
    }
  }, [messageParam])

  const handleEmailLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('email', values.email)
      formData.append('password', values.password)
      if (redirectTo) {
        formData.append('redirectTo', redirectTo)
      }
      
      await login(formData)
    } catch (error) {
      // Only show error if it's not a redirect (which throws an error)
      if (error instanceof Error && !error.message.includes('NEXT_REDIRECT')) {
        message.error('An unexpected error occurred')
        logger.error('Login error:', error)
      }
      setLoading(false)
    }
  }

  const handleSignup = async (values: { email: string; password: string }) => {
    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('email', values.email)
      formData.append('password', values.password)
      if (redirectTo) {
        formData.append('redirectTo', redirectTo)
      }
      
      await signup(formData)
      // If we reach here, the signup was successful and redirect should happen
    } catch (error) {
      console.error('Signup error:', error)
      // Only show error if it's not a redirect (which throws an error)
      if (error instanceof Error && !error.message.includes('NEXT_REDIRECT')) {
        message.error('An unexpected error occurred during signup')
        logger.error('Signup error:', error)
      }
      setLoading(false)
    }
  }

  const handleForgotPassword = async (values: { email: string }) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/login`
      })
      
      if (error) {
        message.error('Error sending password reset email')
      } else {
        message.success('Password reset email sent! Check your inbox.')
        setIsForgotPasswordMode(false)
      }
    } catch (error) {
      message.error('An unexpected error occurred')
      logger.error('Password reset error:', error)
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      })
      
      if (error) {
        message.error('Google login failed')
        setGoogleLoading(false)
      }
    } catch (error) {
      message.error('An unexpected error occurred')
      logger.error('Google login error:', error)
      setGoogleLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          {/* Logo */}
          <div className={styles.logo}>
            <Logo width={48} />
          </div>
          <TypographyTitle 
            level={1} 
            className={styles.title}
          >
            {isForgotPasswordMode ? 'Reset Password' : isSignupMode ? 'Create Account' : 'Welcome back'}
          </TypographyTitle>
          <TypographyText 
            className={styles.subtitle}
          >
            {isForgotPasswordMode ? 'Enter your email to receive a password reset link' : isSignupMode ? 'Create your account to get started' : 'Sign in to your account'}
          </TypographyText>
        </div>

        {/* Login Form Card */}
        <TypographyCard 
          className={`stackone-card ${styles.formCard}`}
          styles={{ 
            body: { 
              padding: '40px 32px'
            }
          }}
        >
          <TypographyForm
            name={isForgotPasswordMode ? "forgot-password" : isSignupMode ? "signup" : "login"}
            onFinish={isForgotPasswordMode ? handleForgotPassword : isSignupMode ? handleSignup : handleEmailLogin}
            layout="vertical"
            size="large"
            className={styles.form}
          >
            <TypographyFormItem
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
              className={styles.formItem}
            >
              <TypographyInput
                prefix={<MailOutlinedIcon className={styles.inputIcon} />}
                placeholder="Email address"
                className={styles.input}
              />
            </TypographyFormItem>

            {!isForgotPasswordMode && (
              <TypographyFormItem
                name="password"
                rules={[{ required: true, message: 'Please input your password!' }]}
                className={styles.formItem}
              >
                <TypographyInputPassword
                  prefix={<LockOutlinedIcon className={styles.inputIcon} />}
                  placeholder="Password"
                  iconRender={(visible) => (visible ? <EyeTwoToneIcon /> : <EyeInvisibleOutlinedIcon />)}
                  className={styles.input}
                />
              </TypographyFormItem>
            )}

            {messageParam && (
              <TypographyAlert
                message={messageParam}
                type={getMessageType(messageParam)}
                className={styles.alert}
              />
            )}

            <TypographyFormItem className={styles.submitButtonItem}>
              <TypographyButton
                type="primary"
                htmlType="submit"
                loading={loading}
                className={styles.submitButton}
                onMouseEnter={handleSubmitButtonMouseEnter}
                onMouseLeave={handleSubmitButtonMouseLeave}
              >
                {isForgotPasswordMode ? 'Send Reset Email' : isSignupMode ? 'Sign Up' : 'Sign In'}
              </TypographyButton>
            </TypographyFormItem>
          </TypographyForm>

          <TypographyDivider className={styles.divider}>
            or
          </TypographyDivider>

          <TypographyButton
            type="default"
            size="large"
            icon={<GoogleOutlinedIcon />}
            loading={googleLoading}
            onClick={handleGoogleLogin}
            className={styles.googleButton}
            onMouseEnter={handleGoogleButtonMouseEnter}
            onMouseLeave={handleGoogleButtonMouseLeave}
          >
            Continue with Google
          </TypographyButton>
        </TypographyCard>

        {/* Footer */}
        <div className={styles.footer}>
          Don&apos;t have an account?{' '}
          <TypographyLink 
            onClick={() => {
              setIsSignupMode(!isSignupMode)
              setIsForgotPasswordMode(false)
            }}
            className={styles.footerLink}
            onMouseEnter={handleFooterLinkMouseEnter}
            onMouseLeave={handleFooterLinkMouseLeave}
          >
            {isSignupMode ? 'Sign in' : 'Sign up'}
          </TypographyLink>
        </div>

        {/* Additional Links */}
        <div className={styles.additionalLinks}>
          {!isSignupMode && (
            <TypographyLink 
              onClick={() => {
                setIsForgotPasswordMode(!isForgotPasswordMode)
                setIsSignupMode(false)
              }}
              className={styles.additionalLink}
              onMouseEnter={handleAdditionalLinkMouseEnter}
              onMouseLeave={handleAdditionalLinkMouseLeave}
            >
              {isForgotPasswordMode ? 'Back to sign in' : 'Forgot your password?'}
            </TypographyLink>
          )}
        </div>
      </div>
    </div>
  )
}
