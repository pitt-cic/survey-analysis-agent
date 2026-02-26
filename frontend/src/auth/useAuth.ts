import { useState, useEffect } from 'react'
import { signIn, signOut, getCurrentUser, fetchUserAttributes, resetPassword, confirmResetPassword } from 'aws-amplify/auth'
import type { SignInOutput, ResetPasswordOutput } from 'aws-amplify/auth'

interface User {
  username: string
  userId: string
  email?: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<SignInOutput>
  logout: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<ResetPasswordOutput>
  submitPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth(): Promise<void> {
    try {
      const currentUser = await getCurrentUser()
      const attributes = await fetchUserAttributes()
      setUser({
        username: currentUser.username,
        userId: currentUser.userId,
        email: attributes.email,
      })
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function login(username: string, password: string): Promise<SignInOutput> {
    const result = await signIn({ username, password })
    if (result.isSignedIn) {
      await checkAuth()
    }
    return result
  }

  async function logout(): Promise<void> {
    await signOut()
    setUser(null)
  }

  function requestPasswordReset(email: string): Promise<ResetPasswordOutput> {
    return resetPassword({ username: email })
  }

  async function submitPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    })
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    requestPasswordReset,
    submitPasswordReset,
  }
}
