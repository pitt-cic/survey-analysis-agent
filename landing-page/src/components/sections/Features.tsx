import { motion } from 'motion/react';
import { GlowCard } from '../ui/GlowCard';

const features = [
  {
    title: 'Natural Language Queries',
    description: 'No SQL or complex filters, just natural questions.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 10h.01" />
        <path d="M12 10h.01" />
        <path d="M16 10h.01" />
      </svg>
    ),
  },
  {
    title: 'Semantic Search',
    description: 'AI understands meaning and context, not just keywords. Find relevant responses even with different wording.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
        <path d="M11 8v6" />
        <path d="M8 11h6" />
      </svg>
    ),
  },
  {
    title: 'Export & Download',
    description: 'Get your analysis as Markdown or export cited responses as CSV.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
  },
  {
    title: 'Theme Discovery',
    description: 'Automatic pattern recognition surfaces key themes across responses.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    title: 'Citation-Backed Insights',
    description: 'Every insight links back to source responses. Verify findings with original data.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
        <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powerful <span className="text-gradient">Capabilities</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Everything you need to extract meaningful insights from survey data.
          </p>
        </motion.div>

        {/* Custom grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {/* Row 1: Large (2x2) + Two Tall (1x2 each) */}
          {/* Natural Language Queries - Large */}
          <div className="md:col-span-2 md:row-span-2">
            <GlowCard delay={0} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center text-white mb-4">
                {features[0].icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {features[0].title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] flex-1">
                {features[0].description}
              </p>
            </GlowCard>
          </div>
          {/* Semantic Search - Tall */}
          <div className="md:row-span-2">
            <GlowCard delay={0.1} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center text-white mb-4">
                {features[1].icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {features[1].title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] flex-1">
                {features[1].description}
              </p>
            </GlowCard>
          </div>
          {/* Export & Download - Tall (swapped) */}
          <div className="md:row-span-2">
            <GlowCard delay={0.2} className="h-full flex flex-col min-h-[200px] md:min-h-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center text-white mb-4">
                {features[2].icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {features[2].title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] flex-1">
                {features[2].description}
              </p>
            </GlowCard>
          </div>

          {/* Row 2: Two Wide cards spanning full width */}
          {/* Theme Discovery - Wide */}
          <div className="md:col-span-2">
            <GlowCard delay={0.3} className="h-full flex flex-col min-h-[140px]">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center text-white mb-4">
                {features[3].icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {features[3].title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] flex-1">
                {features[3].description}
              </p>
            </GlowCard>
          </div>
          {/* Citation-Backed Insights - Wide (swapped) */}
          <div className="md:col-span-2">
            <GlowCard delay={0.4} className="h-full flex flex-col min-h-[140px]">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-accent-amber)] to-[var(--color-accent-orange)] flex items-center justify-center text-white mb-4">
                {features[4].icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {features[4].title}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] flex-1">
                {features[4].description}
              </p>
            </GlowCard>
          </div>
        </div>
      </div>
    </section>
  );
}
