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
import { useCriarPasta } from '../hooks/useEngenhariaPastas';

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

interface CriarPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se `null`, cria pasta avulsa raiz; senão cria subpasta dentro de `parentId`. */
  parentId: string | null;
}

export function CriarPastaDialog({ open, onOpenChange, parentId }: CriarPastaDialogProps) {
  const { showToast } = useToast();
  const criar = useCriarPasta();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '' },
  });

  // Limpa o formulário quando o dialog fecha.
  useEffect(() => {
    if (!open) reset({ nome: '' });
  }, [open, reset]);

  async function onSubmit(values: FormValues) {
    try {
      await criar.mutateAsync({
        nome: values.nome.trim(),
        parentId,
        tipo: parentId ? 'subpasta' : 'avulsa',
      });
      showToast({
        kind: 'success',
        message: parentId ? 'Subpasta criada.' : 'Pasta avulsa criada.',
      });
      onOpenChange(false);
    } catch (err) {
      showToast({
        kind: 'error',
        message: `Falha ao criar pasta: ${(err as Error).message}`,
      });
    }
  }

  const titulo = parentId ? 'Nova subpasta' : 'Nova pasta avulsa';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {parentId
              ? 'A subpasta será criada dentro da pasta atual.'
              : 'Pastas avulsas ficam na raiz de Engenharia.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="nome-pasta">Nome</Label>
            <Input
              id="nome-pasta"
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
              {isSubmitting ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CriarPastaDialog;
