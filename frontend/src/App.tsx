import { useState } from 'react'
import { useQueryWithPolling } from './api/query'
import type { JobResult } from './api/query'
import { useAuth } from './auth/useAuth'
import { LoginForm } from './auth/LoginForm'
import { ProcessingIndicator } from './components/ProcessingIndicator'
import { AnalysisResult, analysisToMarkdown } from './components/AnalysisResult'

function App() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const [input, setInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [copied, setCopied] = useState(false)

  const {
    submit,
    isSubmitting,
    isPolling,
    isComplete,
    isFailed,
    result,
    submitError,
    jobError,
    status,
    reset,
  } = useQueryWithPolling()

  const isProcessing = isSubmitting || isPolling
  const hasError = isFailed || !!submitError

  const handleDownloadMarkdown = () => {
    if (!result?.response) return

    const markdown = analysisToMarkdown(result.response)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analysis-results.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadCitedResponses = () => {
    if (!result?.cited_responses?.s3_url) return

    const link = document.createElement('a')
    link.href = result.cited_responses.s3_url
    link.download = 'cited-responses.csv'
    link.click()
  }

  const handleDownloadSearchResults = () => {
    if (!result?.search_results?.s3_url) return

    const link = document.createElement('a')
    link.href = result.search_results.s3_url
    link.download = 'search-results.csv'
    link.click()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setSubmittedQuery(input.trim())
    submit(input.trim())
  }

  const handleCopyResponse = async () => {
    if (!result?.response) return
    const markdown = analysisToMarkdown(result.response)
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNewQuery = () => {
    setInput('')
    setSubmittedQuery('')
    reset()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-600 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 bg-grid">
      {/* Header */}
      <header className="border-b border-slate-800/60 backdrop-blur-sm animate-fade-up">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">Survey Analysis</h1>
              <p className="text-xs text-slate-300">AI-powered insights</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">{user?.email}</span>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs text-slate-400 border border-slate-700 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Single-query notice */}
          {!isComplete && !hasError && !isPolling && (
            <div className="animate-fade-up delay-1 mb-6 flex items-center gap-2 text-xs text-slate-300">
              <svg className="w-4 h-4 text-amber-500/70" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>Each query runs independently</span>
            </div>
          )}

          {/* Input card - show when not processing and no results */}
          {!isComplete && !hasError && !isPolling && (
            <div className="animate-fade-up delay-2 bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
              <form onSubmit={handleSubmit}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="What would you like to know about the survey data?"
                  rows={5}
                  className="w-full px-5 py-4 bg-transparent text-slate-200 placeholder-slate-400 resize-none focus:outline-none text-sm leading-relaxed"
                />
                <div className="flex items-center justify-end px-4 py-3 border-t border-slate-800/60 bg-slate-900/30">
                  <button
                    type="submit"
                    disabled={isProcessing || !input.trim()}
                    className="px-4 py-1.5 text-sm font-medium bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Run Analysis</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Processing indicator - show when polling */}
          {isPolling && !isComplete && !hasError && (
            <ProcessingIndicator status={status} query={submittedQuery} />
          )}

          {/* Error state */}
          {hasError && (
            <div className="mt-6 space-y-4 animate-fade-up">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-400">Analysis failed</p>
                    <p className="text-sm text-red-400/70 mt-0.5">{submitError?.message || jobError || 'An error occurred'}</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleNewQuery}
                  className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Success state */}
          {isComplete && result && (() => {
            const data = result as JobResult

            return (
              <div className="mt-6 space-y-4 animate-fade-up">
                {/* User's query */}
                {submittedQuery && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-5 py-4">
                    <p className="text-xs font-medium text-slate-500 mb-1">Your query</p>
                    <p className="text-sm text-slate-200 leading-relaxed">{submittedQuery}</p>
                  </div>
                )}

                {/* Response card */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/30">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-slate-300">Analysis Complete</span>
                      {data.metadata && (
                        <span className="text-xs text-slate-500">
                          • {(data.metadata.execution_time_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyResponse}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                      >
                        {copied ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </button>
                      <button
                        onClick={handleDownloadCitedResponses}
                        disabled={!data.cited_responses?.s3_url}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          data.cited_responses?.row_count > 0
                            ? `Download ${data.cited_responses.row_count} cited responses as CSV`
                            : 'No cited responses to download'
                        }
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Cited ({data.cited_responses?.row_count || 0})
                      </button>
                      <button
                        onClick={handleDownloadSearchResults}
                        disabled={!data.search_results?.s3_url}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          data.search_results?.row_count > 0
                            ? `Download ${data.search_results.row_count} search results as CSV`
                            : 'No search results to download'
                        }
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Search ({data.search_results?.row_count || 0})
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <AnalysisResult response={data.response} />
                  </div>
                </div>

                {/* New Query button */}
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleNewQuery}
                    className="px-4 py-2 text-sm font-medium text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Query
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Empty state */}
          {!isComplete && !hasError && !isProcessing && (
            <div className="mt-16 flex flex-col items-center text-center animate-fade-up delay-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-sm font-medium text-slate-300 mb-1">Ready for your query</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Describe what you want to analyze and the agent will search the survey data
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
