import { motion } from 'motion/react';

export function Architecture() {
  return (
    <section id="architecture" className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Enterprise-Grade <span className="text-gradient">Architecture</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Built on AWS serverless infrastructure for scalability, reliability, and cost efficiency.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-5xl mx-auto"
        >
          <div className="glow-card p-4 md:p-8">
            <img
              src="./architecture-diagram.jpeg"
              alt="Survey Analysis Agent Architecture Diagram"
              className="w-full rounded-lg"
            />
          </div>
        </motion.div>

        {/* Architecture highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap justify-center gap-3"
        >
          {[
            'Serverless',
            'Auto-scaling',
            'Event-driven',
            'Async Processing',
            'Secure Auth',
          ].map((tag) => (
            <span
              key={tag}
              className="px-4 py-2 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] text-sm text-[var(--color-text-secondary)]"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
