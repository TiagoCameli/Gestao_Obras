import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** When true, applies a subtle inner top-highlight (premium elevated look). */
  elevated?: boolean;
}

export default function Card({ children, className = '', elevated = false }: CardProps) {
  return (
    <div
      className={
        'card-premium p-6 ' +
        (elevated ? 'elevate-top ' : '') +
        className
      }
    >
      {children}
    </div>
  );
}
