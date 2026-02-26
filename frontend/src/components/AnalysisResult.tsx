import { useState } from 'react'
import type { AnalysisResponse } from '../api/query'

interface AnalysisResultProps {
  response: AnalysisResponse
}

export function AnalysisResult({ response }: AnalysisResultProps): React.ReactElement {
  const [expandedThemes, setExpandedThemes] = useState<Set<number>>(new Set())

  function toggleTheme(index: number): void {
    setExpandedThemes(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <section>
        <h1 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full" />
          Summary
        </h1>
        <p className="text-sm text-slate-300 leading-relaxed pl-3">
          {response.summary}
        </p>
      </section>

      {/* Themes */}
      <div className="space-y-4">
        {response.themes.map((theme, index) => {
          const isExpanded = expandedThemes.has(index)
          const citationCount = theme.supporting_citations.length

          return (
            <section
              key={index}
              className="border border-slate-800/60 rounded-lg overflow-hidden bg-slate-900/30"
            >
              {/* Theme Header */}
              <div className="px-4 py-3 border-b border-slate-800/40">
                <h2 className="text-base font-medium text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80" />
                  {theme.name}
                </h2>
              </div>

              {/* Theme Content */}
              <div className="px-4 py-3">
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  {theme.summary}
                </p>

                {/* Citations Toggle */}
                {citationCount > 0 && (
                  <div>
                    <button
                      onClick={() => toggleTheme(index)}
                      className="group flex items-center gap-1.5 text-xs font-medium text-amber-500/90 hover:text-amber-400 transition-colors"
                    >
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center bg-amber-500/10 group-hover:bg-amber-500/20 transition-all duration-200"
                      >
                        {isExpanded ? (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                          </svg>
                        ) : (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        )}
                      </span>
                      <span>
                        {isExpanded ? `Hide ${citationCount}` : `Show ${citationCount}`}
                        {citationCount === 1 ? ' citation' : ' citations'}
                      </span>
                    </button>

                    {/* Citations List */}
                    <div
                      className={`
                        overflow-hidden transition-all duration-300 ease-out
                        ${isExpanded ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}
                      `}
                    >
                      <div className="space-y-2 pl-1">
                        {theme.supporting_citations.map((citation, citIndex) => (
                          <blockquote
                            key={citIndex}
                            className={`
                              relative pl-3 py-2 text-sm text-slate-400 italic
                              border-l-2 border-slate-700/60
                              bg-slate-800/20 rounded-r
                              transform transition-all duration-300 ease-out
                              ${isExpanded
                                ? 'translate-x-0 opacity-100'
                                : '-translate-x-2 opacity-0'
                              }
                            `}
                            style={{
                              transitionDelay: isExpanded ? `${citIndex * 50}ms` : '0ms'
                            }}
                          >
                            <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/40 to-transparent" />
                            "{citation.excerpt}"
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
