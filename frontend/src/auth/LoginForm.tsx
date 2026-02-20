import { useState } from 'react'
import { useAuth } from './useAuth'

export function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [view, setView] = useState<'login' | 'forgotPassword' | 'resetPassword' | 'newPassword'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login, requestPasswordReset, submitPasswordReset } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await login(username, password)

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setView('newPassword')
      } else if (result.isSignedIn) {
        window.location.reload()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const { confirmSignIn } = await import('aws-amplify/auth')
      await confirmSignIn({
        challengeResponse: newPassword,
        options: {
          userAttributes: {
            given_name: givenName,
            family_name: familyName,
          },
        },
      })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await requestPasswordReset(resetEmail)
      setView('resetPassword')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset code')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await submitPasswordReset(resetEmail, resetCode, newPassword)
      setSuccessMessage('Password reset successful! Please sign in.')
      setView('login')
      setResetEmail('')
      setResetCode('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClasses = "w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors text-sm"
  const labelClasses = "block text-sm font-medium text-slate-300 mb-1.5"

  if (view === 'newPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-grid p-4">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-white mb-1">Complete your profile</h1>
            <p className="text-sm text-slate-400 mb-6">Set a new password to continue</p>

            <form onSubmit={handleNewPassword} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>First name</label>
                  <input
                    type="text"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                    className={inputClasses}
                    required
                  />
                </div>
                <div>
                  <label className={labelClasses}>Last name</label>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className={inputClasses}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClasses}>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-amber-500 text-slate-950 font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'forgotPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-grid p-4">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-white mb-1">Reset password</h1>
            <p className="text-sm text-slate-400 mb-6">Enter your email to receive a reset code</p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-amber-500 text-slate-950 font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  'Send reset code'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('')
                  setView('login')
                }}
                className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Back to sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'resetPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-grid p-4">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
            <h1 className="text-xl font-semibold text-white mb-1">Enter reset code</h1>
            <p className="text-sm text-slate-400 mb-6">Check your email for the verification code</p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className={labelClasses}>Verification code</label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className={inputClasses}
                  placeholder="Enter 6-digit code"
                  required
                />
              </div>

              <div>
                <label className={labelClasses}>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClasses}
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-amber-500 text-slate-950 font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  'Reset password'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('')
                  setView('forgotPassword')
                }}
                className="w-full text-sm text-slate-400 hover:text-slate-300 transition-colors"
              >
                Resend code
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 bg-grid p-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Logo and title */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Survey Analysis</h1>
          <p className="text-sm text-slate-400">AI-powered insights</p>
        </div>

        {/* Login card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClasses}>Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClasses}
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setSuccessMessage('')
                  setView('forgotPassword')
                }}
                className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-400">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-amber-500 text-slate-950 font-medium rounded-lg hover:bg-amber-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
