import { Link } from 'react-router-dom';

export default function AcessoNegado() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="text-6xl font-semibold text-[var(--color-danger)]/70 mb-4 tracking-tight">403</div>
      <h1 className="text-xl font-semibold text-[var(--color-fg)] mb-2 tracking-tight">Acesso Negado</h1>
      <p className="text-[var(--color-fg-muted)] mb-6">
        Você não tem permissão para acessar esta página.
      </p>
      <Link
        to="/"
        className="px-5 h-10 inline-flex items-center rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] text-sm font-semibold hover:bg-[var(--color-accent-hover)] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-xs)]"
      >
        Voltar ao Início
      </Link>
    </div>
  );
}
