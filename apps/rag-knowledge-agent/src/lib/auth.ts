import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { query, queryOne } from '@/lib/db'

/** Find or create a user in public.users by email (for OAuth e.g. Google). */
async function findOrCreateOAuthUser(email: string, name?: string | null): Promise<{ id: string; email: string }> {
  const existing = await queryOne<{ id: string; email: string }>(
    'SELECT id, email FROM users WHERE email = $1',
    [email]
  )
  if (existing) return existing
  const rows = await query<{ id: string; email: string }>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, NULL) RETURNING id, email`,
    [email, name ?? null]
  )
  const created = rows[0]
  if (!created) throw new Error('Failed to create user')
  return created
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await queryOne<{ id: string; email: string; password_hash: string | null }>(
          'SELECT id, email, password_hash FROM users WHERE email = $1',
          [credentials.email]
        )
        if (!user?.password_hash) return null
        const ok = await compare(credentials.password, user.password_hash)
        if (!ok) return null
        return { id: user.id, email: user.email }
      },
    }),
    // Google SSO: add only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user, account }) {
      // Credentials sign-in: user already has our DB id
      if (user?.id && account?.provider === 'credentials') {
        token.id = user.id
        token.email = user.email ?? undefined
        return token
      }
      // OAuth (e.g. Google): find or create user in our DB and set token.id
      if (user?.email && account?.provider === 'google') {
        const dbUser = await findOrCreateOAuthUser(user.email, user.name ?? undefined)
        token.id = dbUser.id
        token.email = dbUser.email
        return token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: { signIn: '/login' },
}
