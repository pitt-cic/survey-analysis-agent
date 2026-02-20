import { motion } from 'motion/react';

const technologies = [
  {
    name: 'Amazon Bedrock',
    description: 'Claude Sonnet & Titan Embeddings',
  },
  {
    name: 'S3 Vectors',
    description: 'Vector storage for semantic search',
  },
  {
    name: 'AWS Lambda',
    description: 'Serverless compute',
  },
  {
    name: 'AWS Amplify',
    description: 'Frontend hosting',
  },
  {
    name: 'DynamoDB',
    description: 'Async job tracking',
  },
  {
    name: 'Cognito',
    description: 'User authentication',
  },
  {
    name: 'React',
    description: 'Frontend framework',
  },
  {
    name: 'Pydantic AI',
    description: 'Agent framework',
  },
];

export function TechStack() {
  return (
    <section id="tech-stack" className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Built With <span className="text-gradient">Modern Tech</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Powered by cutting-edge AWS services and AI frameworks.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {technologies.map((tech, index) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -4, borderColor: 'rgba(245, 158, 11, 0.3)' }}
              className="flex flex-col items-center justify-center p-6 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border-subtle)] transition-all cursor-default text-center"
            >
              <span className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                {tech.name}
              </span>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {tech.description}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
