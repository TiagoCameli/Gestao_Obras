import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Button from './Button';
import Spinner from './Spinner';

interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Estado assíncrono real: formState.isSubmitting (RHF) ou mutation.isPending (TanStack). */
  loading: boolean;
  /** Regra de disabled que o form já calcula (ex.: !isValid || !canAct). */
  disabled?: boolean;
  /** Texto enquanto salva. Default: "Salvando...". */
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

/**
 * Botão de submit à prova de duplo-clique. Quando `loading`, fica desabilitado e
 * mostra um spinner — impede segunda gravação enquanto a primeira está em voo.
 */
export default function SubmitButton({
  loading,
  disabled = false,
  loadingLabel = 'Salvando...',
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={loading || disabled} aria-busy={loading} {...props}>
      {loading ? (
        <>
          <Spinner size="sm" label="" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
