/**
 * Drawer — wrapper sobre shadcn Sheet mantendo a API legada.
 *
 * Mesmo raciocínio do Modal: 20+ callsites usam <Drawer>; swap do internals
 * pra shadcn Sheet (Radix Dialog com side="right") dá trap-focus, escape,
 * portal, aria-* corretos e animação slide.
 *
 * API preservada (1:1 com a versão anterior):
 *   open, onClose, title, subtitle, children, footer, width
 *
 * Diferenças sutis:
 *   - X aparece via Sheet (top-3 right-3 default).
 *   - Animação de slide-in agora vem de tw-animate-css (radix data-state).
 *   - Foco inicial no primeiro focusable do content (Radix default).
 */
import type { ReactNode } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../shadcn/sheet';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

const widthClasses: Record<NonNullable<DrawerProps['width']>, string> = {
  md: 'sm:!max-w-lg',
  lg: 'sm:!max-w-2xl',
  xl: 'sm:!max-w-3xl',
};

export default function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent
        side="right"
        className={
          // Default shadcn é w-3/4 mobile, sm:max-w-sm desktop. Override pro nosso
          // mapping (md/lg/xl) e nossos tokens (surface-1, border, shadow-xl).
          'w-full ' + widthClasses[width] + ' ' +
          'flex flex-col gap-0 p-0 ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border-l border-[var(--color-border)] ' +
          'shadow-[var(--shadow-xl)]'
        }
      >
        <SheetHeader
          className={
            'flex flex-col gap-0.5 px-6 py-5 ' +
            'border-b border-[var(--color-border)] ' +
            'bg-[var(--color-surface-1)]/95 backdrop-blur-sm'
          }
        >
          <SheetTitle className="text-lg font-semibold tracking-tight truncate text-[var(--color-fg)] pr-9">
            {title}
          </SheetTitle>
          {subtitle && (
            <SheetDescription className="text-xs text-[var(--color-fg-muted)] truncate">
              {subtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <SheetFooter className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
