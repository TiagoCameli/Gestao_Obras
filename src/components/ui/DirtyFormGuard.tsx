/**
 * DirtyFormGuard — substitui o pattern `window.confirm("Alterações não
 * salvas. Sair?")` por um ConfirmDialog assíncrono integrado ao Modal.
 *
 * Como usar:
 *
 *   const guard = useDirtyFormGuard({ dirty: formDirty, onClose: doClose });
 *
 *   <Modal
 *     open={open}
 *     onClose={doClose}
 *     onClosePending={guard.onClosePending}  // X / ESC / backdrop
 *     title="..."
 *   >
 *     <Form />
 *     <Button onClick={guard.tryClose}>Cancelar</Button>  // botão explícito
 *   </Modal>
 *   {guard.dialog}  // <— em qualquer lugar (Modal usa Radix portal)
 *
 * Comportamento:
 *  - dirty=false → tryClose() chama onClose() direto; onClosePending fica
 *    undefined (Modal usa seu fluxo padrão sem confirmar).
 *  - dirty=true → tryClose() abre o ConfirmDialog; user confirma → onClose()
 *    chamado; user cancela → ConfirmDialog fecha e modal segue aberto.
 */
import { useCallback, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

interface DirtyFormGuardOptions {
  dirty: boolean;
  onClose: () => void;
  /** Custom message. Default: "Você tem alterações não salvas. Sair mesmo assim?" */
  message?: string;
  /** Custom title. Default: "Alterações não salvas" */
  title?: string;
}

export function useDirtyFormGuard({
  dirty,
  onClose,
  message,
  title,
}: DirtyFormGuardOptions) {
  const [pending, setPending] = useState(false);

  /** Chama daqui pra tentar fechar (use no botão "Cancelar" explícito). */
  const tryClose = useCallback(() => {
    if (dirty) {
      setPending(true);
    } else {
      onClose();
    }
  }, [dirty, onClose]);

  /** Passe pro Modal onClosePending. Quando dirty=false, fica undefined
   *  (Modal usa seu close path normal — não precisa interceptar). */
  const onClosePending = dirty ? () => setPending(true) : undefined;

  const handleConfirm = useCallback(() => {
    setPending(false);
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(() => {
    setPending(false);
  }, []);

  const dialog = (
    <ConfirmDialog
      open={pending}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      title={title ?? 'Alterações não salvas'}
      message={message ?? 'Você tem alterações não salvas. Sair mesmo assim?'}
      requirePassword={false}
    />
  );

  return { tryClose, onClosePending, dialog };
}
