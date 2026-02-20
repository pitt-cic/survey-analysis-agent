import { motion } from 'motion/react';

const DEMO_VIDEO_URL = 'https://github.com/user-attachments/assets/985bb1f0-909f-472e-8356-c8c06e89096f';

export function Demo() {
  return (
    <section id="demo" className="section relative">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[var(--color-accent-amber)] opacity-[0.06] blur-[150px] rounded-full" />

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            See It In <span className="text-gradient">Action</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Watch how Survey Analysis Agent transforms natural language questions into actionable insights.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="terminal-window shadow-2xl">
            <div className="terminal-header">
              <div className="terminal-dot terminal-dot-red" />
              <div className="terminal-dot terminal-dot-yellow" />
              <div className="terminal-dot terminal-dot-green" />
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">
                Survey Analysis Demo
              </span>
            </div>
            <div className="relative aspect-video bg-black">
              <video
                controls
                className="w-full h-full"
                preload="metadata"
              >
                <source src={DEMO_VIDEO_URL} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          {/* Reflection effect */}
          <div className="h-20 bg-gradient-to-b from-[var(--color-bg-secondary)]/30 to-transparent -mt-1 rounded-b-xl blur-sm" />
        </motion.div>
      </div>
    </section>
  );
}
