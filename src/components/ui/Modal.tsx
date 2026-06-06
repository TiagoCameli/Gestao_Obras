/**
 * Modal — wrapper sobre shadcn Dialog mantendo a API legada.
 *
 * Por que wrapper: 48+ callsites no app usam <Modal>; swap dos internals
 * pra shadcn (Radix) dá trap-focus, escape, restoração de foco, portal,
 * aria-* corretos e animação fade+zoom de graça — sem precisar tocar em
 * nenhum callsite.
 *
 * API preservada (1:1 com a versão anterior):
 *   open, onClose, title, children, size, confirmClose
 *
 * Diferenças sutis vs versão anterior (não-quebrantes):
 *   - X aparece no canto mas usa estilo shadcn (ghost button icon-sm).
 *   - Animação de entrada agora é fade+zoom (radix), não corte seco.
 *   - Foco inicial: Radix coloca foco no primeiro elemento focusable do
 *     content (antes era no body). Comportamento mais a11y-correct.
 */
import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'default' | 'lg' | 'xl';
  /**
   * Callback SÍNCRONO executado antes de qualquer tentativa de fechar
   * (X, backdrop, Escape). Retornando `false`, o fechamento é abortado.
   * Útil pra confirmar inline (sem dialog assíncrono).
   *
   * Deprecated em favor de `onClosePending` quando você precisa de
   * confirmação visual com ConfirmDialog (assíncrono). Mantido por compat.
   */
  confirmClose?: () => boolean;
  /**
   * Callback opcional disparado quando o usuário tenta fechar o modal
   * (X, backdrop, Escape). Quando set, SUBSTITUI o caminho de close
   * default — o componente pai vira responsável por decidir entre:
   *   - chamar onClose() pra fechar de verdade
   *   - não chamar pra manter o modal aberto
   *
   * Usado pra abrir um ConfirmDialog assíncrono (ex: "alterações não
   * salvas"). Use junto com o hook useDirtyFormGuard que cuida do state
   * e do render do dialog.
   */
  onClosePending?: () => void;
  /** Classe extra no conteúdo do dialog (ex.: z-index quando aninhado em overlay alto). */
  contentClassName?: string;
  /** Classe extra no overlay do dialog (par do contentClassName pro backdrop subir junto). */
  overlayClassName?: string;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  default: 'sm:max-w-2xl',
  lg:      'sm:max-w-4xl',
  xl:      'sm:max-w-6xl',
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'default',
  confirmClose,
  onClosePending,
  contentClassName,
  overlayClassName,
}: ModalProps) {
  const handleOpenChange = (next: boolean) => {
    // Só interceptamos closes (Radix nunca chama com next=true sem trigger explícito).
    if (next) return;
    // onClosePending tem prioridade — pai decide o que fazer (abrir ConfirmDialog etc).
    if (onClosePending) {
      onClosePending();
      return;
    }
    if (confirmClose && !confirmClose()) return;
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={overlayClassName}
        className={
          // Reseta o padding/max-width default do shadcn (p-4, sm:max-w-sm, gap-4)
          // e aplica nosso visual: surface-1 bg, border, shadow-xl, sm:rounded-2xl,
          // header sticky, max-height responsivo, padding 0 (header e body têm próprio).
          'p-0 gap-0 max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto ' +
          'bg-[var(--color-surface-1)] text-[var(--color-fg)] ' +
          'border border-[var(--color-border)] sm:rounded-2xl ' +
          'shadow-[var(--shadow-xl)] elevate-top ' +
          'w-full ' + sizeClasses[size] +
          (contentClassName ? ' ' + contentClassName : '')
        }
      >
        <DialogHeader
          className={
            'flex-row items-center justify-between gap-3 p-4 sm:p-5 ' +
            'border-b border-[var(--color-border)] ' +
            'sticky top-0 bg-[var(--color-surface-1)]/95 backdrop-blur-sm z-10'
          }
        >
          <DialogTitle className="text-base sm:text-lg font-semibold text-[var(--color-fg)] tracking-tight">
            {title}
          </DialogTitle>
          {/* X built-in do shadcn fica em absolute top-2 right-2 dentro do DialogContent.
              Mantemos o slot no header (vazio) só pra preservar o alinhamento title/right. */}
          <div className="w-9" aria-hidden />
        </DialogHeader>
        <div className="p-4 sm:p-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
