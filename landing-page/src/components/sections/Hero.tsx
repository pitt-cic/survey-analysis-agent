import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

interface ThemeSection {
  title: string;
  description: string;
  count: number;
  citations: string[];
}

const themes: ThemeSection[] = [
  {
    title: 'Limited availability',
    description: 'Guests have mentioned that parking fills up fast, especially for weekend games, and it can be difficult to find spaces close to the venue.',
    count: 234,
    citations: [
      '"Parking fills up way too fast, especially for weekend games..."',
      '"By the time I arrive there are never any spots left nearby..."',
      '"Need more parking options - always full an hour before kickoff..."',
    ],
  },
  {
    title: 'High costs',
    description: 'Many respondents feel that parking fees are too expensive, with some noting that costs have increased over recent seasons.',
    count: 189,
    citations: [
      '"$40 for parking is outrageous for a college game..."',
      '"The parking fees keep going up every season..."',
      '"Would attend more games if parking wasn\'t so expensive..."',
    ],
  },
  {
    title: 'Distance from venue',
    description: 'Fans have expressed frustration about having to park far from the stadium, particularly those with children or mobility concerns.',
    count: 156,
    citations: [
      '"Had to walk 20 minutes from the lot to the stadium..."',
      '"Remote parking is too far, especially with kids..."',
      '"Shuttle service from distant lots is unreliable..."',
    ],
  },
];

function ExpandableCitation({ theme, delay }: { theme: ThemeSection; delay: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const remainingCount = theme.count - theme.citations.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="border-l-2 border-[var(--color-accent-amber)]/30 pl-4 py-2"
    >
      <div className="mb-2">
        <span className="text-[var(--color-text-primary)] font-semibold">{theme.title}:</span>
        <span className="text-[var(--color-text-secondary)] text-sm ml-2">{theme.description}</span>
        <span className="text-[var(--color-text-tertiary)] text-sm ml-2">({theme.count} mentions)</span>
      </div>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-left group"
      >
        <span className="w-5 h-5 rounded bg-[var(--color-bg-tertiary)] flex items-center justify-center text-xs text-[var(--color-accent-amber)] group-hover:bg-[var(--color-accent-amber)]/20 transition-colors">
          {isExpanded ? '−' : '+'}
        </span>
        <span className="text-[var(--color-accent-amber)] text-sm">Citations</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 pl-7">
              {theme.citations.map((citation, i) => (
                <p key={i} className="text-xs text-[var(--color-text-tertiary)] italic">
                  {citation}
                </p>
              ))}
              <p className="text-xs text-[var(--color-accent-amber)]/70">
                +{remainingCount} more responses...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Hero() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-grid pt-16">
      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[var(--color-accent-amber)] opacity-[0.08] blur-[120px] rounded-full" />

      <div className="container relative z-10 text-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-accent)] text-sm text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-amber)] animate-pulse" />
            AI-Powered Survey Analysis
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
        >
          Transform Survey Data Into
          <br />
          <span className="text-gradient">Actionable Insights</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10"
        >
          Ask questions in plain English and get intelligent analysis backed by citations.
          Semantic search that understands meaning, not just keywords.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <a href="#demo" className="btn-primary">
            Watch Demo
          </a>
          <a
            href="#architecture"
            className="px-6 py-3 rounded-xl border border-[var(--color-border-accent)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card)] transition-colors"
          >
            View Architecture
          </a>
        </motion.div>

        {/* Query/Response Visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
          className="max-w-3xl mx-auto"
        >
          <div className="glow-card p-6 md:p-8 text-left">
            {/* Question */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Your Question</p>
                <p className="text-[var(--color-text-primary)] font-medium">
                  What are the main complaints about parking at games?
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--color-accent-amber)]/30 to-transparent" />
            </div>

            {/* Loading or Response */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 rounded-full border-2 border-[var(--color-accent-amber)]/30 border-t-[var(--color-accent-amber)]"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-1">AI Analysis</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Analyzing 847 survey responses...</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Response */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-accent-amber)]">
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-2">AI Analysis</p>
                      <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-4">
                        Based on 847 survey responses, I identified 3 main themes regarding parking complaints:
                      </p>

                      {/* Expandable themes */}
                      <div className="space-y-3">
                        {themes.map((theme, index) => (
                          <ExpandableCitation key={theme.title} theme={theme} delay={index * 0.1} />
                        ))}
                      </div>

                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
