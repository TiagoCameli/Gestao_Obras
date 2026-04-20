import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-6xl font-semibold text-[var(--color-fg-subtle)]/60 tracking-tight">404</h1>
      <p className="text-[var(--color-fg-muted)] mt-4 mb-8">Página não encontrada</p>
      <Link
        to="/"
        className="inline-flex items-center h-10 px-5 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-xs)]"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
