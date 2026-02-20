import { useState, useEffect } from 'react'
import { signIn, signOut, getCurrentUser, fetchAuthSession, fetchUserAttributes, resetPassword, confirmResetPassword } from 'aws-amplify/auth'

interface User {
  username: string
  userId: string
  email?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
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

  async function login(username: string, password: string) {
    const result = await signIn({ username, password })
    if (result.isSignedIn) {
      await checkAuth()
    }
    return result
  }

  async function logout() {
    await signOut()
    setUser(null)
  }

  async function getAuthToken() {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString()
  }

  async function requestPasswordReset(email: string) {
    return await resetPassword({ username: email })
  }

  async function submitPasswordReset(email: string, code: string, newPassword: string) {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword: newPassword,
    })
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    getAuthToken,
    requestPasswordReset,
    submitPasswordReset,
  }
}
