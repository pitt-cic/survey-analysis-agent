import { useState, useEffect } from 'react'
import type { JobStatus } from '../api/query'

interface ProcessingIndicatorProps {
  status?: JobStatus
  query?: string
}

const phases = [
  { key: 'PENDING', label: 'Queued' },
  { key: 'PROCESSING', label: 'Analyzing' },
  { key: 'COMPLETED', label: 'Complete' },
] as const

const statusMessages = [
  'Analyzing survey responses',
  'Searching through data',
  'Processing your query',
  'Examining patterns',
  'Compiling insights',
]

export function ProcessingIndicator({ status, query }: ProcessingIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)

  // Elapsed time counter
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Rotate status messages every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % statusMessages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const currentPhaseIndex = phases.findIndex((p) => p.key === status)

  return (
    <div className="animate-fade-up bg-slate-900/50 border border-slate-800 rounded-xl p-8">
      {/* Query display */}
      {query && (
        <div className="mb-6 pb-6 border-b border-slate-800/60">
          <p className="text-xs font-medium text-slate-500 mb-1">Your query</p>
          <p className="text-sm text-slate-200 leading-relaxed">{query}</p>
        </div>
      )}

      {/* Phase timeline */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {phases.map((phase, index) => {
          const isActive = index === currentPhaseIndex
          const isCompleted = index < currentPhaseIndex

          return (
            <div key={phase.key} className="flex items-center">
              {/* Phase dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    relative w-3 h-3 rounded-full transition-all duration-300
                    ${isCompleted ? 'bg-emerald-500' : ''}
                    ${isActive ? 'bg-amber-500 phase-glow' : ''}
                    ${!isActive && !isCompleted ? 'bg-slate-700' : ''}
                  `}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-75" />
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium transition-colors duration-300
                    ${isActive ? 'text-amber-400' : ''}
                    ${isCompleted ? 'text-emerald-400' : ''}
                    ${!isActive && !isCompleted ? 'text-slate-600' : ''}
                  `}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line */}
              {index < phases.length - 1 && (
                <div
                  className={`
                    w-16 h-0.5 mx-2 transition-colors duration-300
                    ${index < currentPhaseIndex ? 'bg-emerald-500/50' : 'bg-slate-700'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Central pulse animation */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-amber-500/20 pulse-ring" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-amber-500/10 pulse-ring delay-1" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 rounded-full border border-amber-500/5 pulse-ring delay-2" />
          </div>

          {/* Center icon */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Status message */}
      <div className="text-center">
        <p className="text-sm text-slate-300 mb-1">
          <span className="inline-block">{statusMessages[messageIndex]}</span>
          <span className="inline-flex w-6 justify-start">
            <span className="typing-dots">...</span>
          </span>
        </p>
        <p className="text-xs text-slate-600 font-mono tabular-nums">
          {elapsedSeconds}s elapsed
        </p>
      </div>
    </div>
  )
}
