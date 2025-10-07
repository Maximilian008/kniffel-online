import { useEffect, useState } from 'react';

type ParticleProps = {
  trigger: boolean;
  color?: string;
  count?: number;
};

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export default function ParticleEffect({ trigger, color = '#ffd700', count = 20 }: ParticleProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    // Create new particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: Math.random(),
        x: Math.random() * 400,
        y: 200,
        vx: (Math.random() - 0.5) * 10,
        vy: Math.random() * -8 - 2,
        life: 60,
        maxLife: 60,
        size: Math.random() * 6 + 2,
        color: color,
      });
    }
    setParticles(newParticles);

    // Animate particles
    const interval = setInterval(() => {
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            vy: particle.vy + 0.3, // gravity
            life: particle.life - 1,
          }))
          .filter(particle => particle.life > 0)
      );
    }, 16);

    // Clean up after animation
    setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
    }, 2000);

    return () => clearInterval(interval);
  }, [trigger, color, count]);

  if (particles.length === 0) return null;

  return (
    <div className="particle-container">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="particle"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.life / particle.maxLife,
          }}
        />
      ))}
    </div>
  );
}