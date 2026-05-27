import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { Label } from '@/components/shadcn/label';
import { useToast } from '@/components/ui/Toast';
import { useRenomearPasta } from '../hooks/useEngenhariaPastas';
import type { EngenhariaPasta } from '../types/pasta';

const NOME_REGEX = /^[\w\s\-.()[\]]+$/u;

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe um nome')
    .max(100, 'Máximo 100 caracteres')
    .regex(NOME_REGEX, 'Use letras, números, espaços e - _ . ( ) [ ]'),
});

type FormValues = z.infer<typeof schema>;

interface RenomearPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta: EngenhariaPasta;
}

export function RenomearPastaDialog({ open, onOpenChange, pasta }: RenomearPastaDialogProps) {
  const { showToast } = useToast();
  const renomear = useRenomearPasta();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: pasta.nome },
  });

  // Reset quando o dialog abre com pasta diferente (ou reabre).
  useEffect(() => {
    if (open) reset({ nome: pasta.nome });
  }, [open, pasta.nome, reset]);

  // Pastas de obra herdam o nome da obra — renomear só faz sentido no cadastro
  // de obras. Bloqueia explicitamente para evitar dessincronia.
  if (pasta.tipo === 'obra') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear bloqueado</DialogTitle>
            <DialogDescription>
              Pastas de obra são renomeadas via cadastro de obras.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  async function onSubmit(values: FormValues) {
    const novoNome = values.nome.trim();
    if (novoNome === pasta.nome) {
      onOpenChange(false);
      return;
    }
    try {
      await renomear.mutateAsync({ id: pasta.id, nome: novoNome });
      showToast({ kind: 'success', message: 'Pasta renomeada.' });
      onOpenChange(false);
    } catch (err) {
      showToast({
        kind: 'error',
        message: `Falha ao renomear: ${(err as Error).message}`,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear pasta</DialogTitle>
          <DialogDescription>
            Apenas o nome muda — o conteúdo da pasta permanece.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="renomear-nome">Nome</Label>
            <Input
              id="renomear-nome"
              autoFocus
              autoComplete="off"
              aria-invalid={!!errors.nome}
              {...register('nome')}
            />
            {errors.nome && (
              <p className="text-xs text-destructive">{errors.nome.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default RenomearPastaDialog;
