import { useState } from 'react';

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface FloatingParticlesProps {
  count?: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
    duration: 15 + Math.random() * 20,
    delay: Math.random() * 15,
    opacity: 0.2 + Math.random() * 0.4,
  }));
}

export function FloatingParticles({ count = 20 }: FloatingParticlesProps) {
  const [particles] = useState<Particle[]>(() => generateParticles(count));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: `rgba(245, 158, 11, ${particle.opacity})`,
            animation: `particle-rise ${particle.duration}s linear infinite`,
            animationDelay: `${particle.delay}s`,
            boxShadow: `0 0 ${particle.size * 2}px rgba(245, 158, 11, 0.3)`,
          }}
        />
      ))}
    </div>
  );
}
