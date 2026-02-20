import type { ReactNode } from 'react';

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[180px] gap-4 ${className}`}>
      {children}
    </div>
  );
}

interface BentoCardProps {
  children: ReactNode;
  size?: 'small' | 'tall' | 'wide' | 'large';
  className?: string;
}

export function BentoCard({ children, size = 'small', className = '' }: BentoCardProps) {
  const sizeClasses = {
    small: '',
    tall: 'md:row-span-2',
    wide: 'md:col-span-2',
    large: 'md:col-span-2 md:row-span-2',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      {children}
    </div>
  );
}
