import { motion } from 'motion/react';

export function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-b border-[var(--color-border-subtle)]"
    >
      <div className="container flex items-center justify-between h-16 px-6">
        <a href="#" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-amber)] transition-colors">
            Survey Analysis Agent
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-amber)] transition-colors">
            Features
          </a>
          <a href="#demo" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-amber)] transition-colors">
            Demo
          </a>
          <a href="#architecture" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-amber)] transition-colors">
            Architecture
          </a>
          <a href="#use-cases" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent-amber)] transition-colors">
            Use Cases
          </a>
        </div>

        <a
          href="#cta"
          className="btn-primary text-sm py-2 px-4"
        >
          Get Started
        </a>
      </div>
    </motion.nav>
  );
}
