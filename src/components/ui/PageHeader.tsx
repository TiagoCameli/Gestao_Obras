/**
 * PageHeader — header unificado de página.
 *
 * Padrão (per docs/design-system.md):
 *   breadcrumb (opcional) > eyebrow (opcional) > h1 > description (opcional)
 *   ações primárias à direita no desktop, embaixo no mobile.
 *
 * Uso:
 *   <PageHeader
 *     breadcrumb={[
 *       { label: 'Operação', href: '/operacao' },
 *       { label: 'Manutenção' },
 *     ]}
 *     eyebrow="Dashboard"
 *     title="Manutenção"
 *     description="OS abertas, custos e disponibilidade."
 *     actions={
 *       <>
 *         <Button variant="secondary"><FileDown /> PDF</Button>
 *         <Button><Plus /> Nova OS</Button>
 *       </>
 *     }
 *   />
 */
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  /** Sem href = último item (não-clicável). */
  href?: string;
}

interface Props {
  breadcrumb?: BreadcrumbItem[];
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  breadcrumb,
  eyebrow,
  title,
  description,
  actions,
  className = '',
}: Props) {
  return (
    <header className={'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6 ' + className}>
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)] mb-1.5">
            {breadcrumb.map((b, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span key={`${b.label}-${i}`}>
                  {b.href && !isLast ? (
                    <Link to={b.href} className="hover:text-[var(--color-fg)] transition-colors">
                      {b.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-[var(--color-fg)] font-medium' : ''}>{b.label}</span>
                  )}
                  {!isLast && (
                    <ChevronRight className="w-3 h-3 inline mx-1 opacity-60" aria-hidden />
                  )}
                </span>
              );
            })}
          </nav>
        )}
        {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
