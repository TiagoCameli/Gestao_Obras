import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Label } from '@/components/shadcn/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select';
import { useToast } from '@/components/ui/Toast';
import { useMoverPasta } from '../hooks/useEngenhariaPastas';
import { dbToEngenhariaPasta, type EngenhariaPasta } from '../types/pasta';

interface MoverPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta: EngenhariaPasta;
}

/** Valor especial usado no <Select> para representar "Raiz". */
const RAIZ_VALUE = '__RAIZ__';

/**
 * Lista todas as pastas ativas (deleted_at IS NULL via RLS) para popular o
 * combo de destino. Só carrega quando o dialog está aberto.
 */
function usePastasTodas(enabled: boolean) {
  return useQuery({
    queryKey: ['engenharia', 'pastas', 'todas'],
    enabled,
    queryFn: async (): Promise<EngenhariaPasta[]> => {
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .select('*')
        .order('caminho', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToEngenhariaPasta);
    },
  });
}

export function MoverPastaDialog({ open, onOpenChange, pasta }: MoverPastaDialogProps) {
  const { showToast } = useToast();
  const mover = useMoverPasta();
  const { data: todas, isLoading } = usePastasTodas(open);
  const [destinoId, setDestinoId] = useState<string>(RAIZ_VALUE);

  // Reset seleção quando o dialog reabre
  useEffect(() => {
    if (open) setDestinoId(RAIZ_VALUE);
  }, [open]);

  // Filtra candidatas: exclui a própria pasta E todos os descendentes
  // (qualquer pasta cujo `caminho` comece com o caminho da atual).
  // Trigger SQL é a defesa final, mas filtrar aqui evita escolhas inválidas.
  const candidatas = useMemo<EngenhariaPasta[]>(() => {
    if (!todas) return [];
    const prefixo = pasta.caminho.endsWith('/') ? pasta.caminho : pasta.caminho + '/';
    return todas.filter((p) => {
      if (p.id === pasta.id) return false;
      if (p.caminho === pasta.caminho) return false;
      if (p.caminho.startsWith(prefixo)) return false;
      // Não move para o mesmo parent atual (no-op).
      if (p.id === pasta.parentId) return false;
      return true;
    });
  }, [todas, pasta]);

  async function handleConfirm() {
    const novoParentId = destinoId === RAIZ_VALUE ? null : destinoId;
    // Se já é raiz e destino é raiz, no-op.
    if (novoParentId === pasta.parentId) {
      onOpenChange(false);
      return;
    }
    try {
      await mover.mutateAsync({ id: pasta.id, novoParentId });
      showToast({ kind: 'success', message: 'Pasta movida.' });
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (/ciclo/i.test(msg)) {
        showToast({ kind: 'error', message: 'Mover ali criaria ciclo na hierarquia.' });
      } else {
        showToast({ kind: 'error', message: `Falha ao mover: ${msg}` });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover pasta</DialogTitle>
          <DialogDescription>
            Escolha o destino para “{pasta.nome}”. Mover para a raiz transforma
            em pasta avulsa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="mover-destino">Destino</Label>
          <Select value={destinoId} onValueChange={setDestinoId}>
            <SelectTrigger id="mover-destino" className="w-full">
              <SelectValue placeholder="Selecione um destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={RAIZ_VALUE}>Raiz (tornar avulsa)</SelectItem>
              {candidatas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.caminho}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoading && (
            <p className="text-xs text-muted-foreground">Carregando pastas…</p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mover.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={mover.isPending || isLoading}
          >
            {mover.isPending ? 'Movendo…' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MoverPastaDialog;
