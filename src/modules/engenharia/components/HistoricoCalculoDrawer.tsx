import { useMemo, useState } from 'react';
import { diffWords } from 'diff';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/shadcn/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog';
import { Badge } from '@/components/shadcn/badge';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { useToast } from '@/components/ui/Toast';
import { useFuncionarios } from '@/hooks/useFuncionarios';
import type {
  DocumentoCalculo,
  EngenhariaCalculo,
  EngenhariaCalculoVersao,
} from '../types/calculo';
import { useCalculoVersoes, useRestaurarVersaoCalculo } from '../hooks/useCalculoVersoes';

interface HistoricoCalculoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculoId: string;
  /** Cálculo atual para resolver título, alerta + número da versão atual (diff e restauração). */
  calculoAtual: EngenhariaCalculo;
  /** Quando true, esconde botão "Restaurar" (modo somente leitura). */
  ehReadOnly: boolean;
}

/** Texto plano de um documento de cálculo: uma expressão por linha. */
function extrairTextoCalculo(doc: DocumentoCalculo): string {
  return (doc?.linhas ?? []).map((l) => l.expressao ?? '').join('\n');
}

/**
 * Drawer lateral (Sheet right) que lista versões de um cálculo, com:
 *  - Cabeçalho (badge versão + autor + timestamp + preview ~120 chars)
 *  - "Ver diff" inline (diffWords entre cálculo atual e a versão escolhida)
 *  - "Restaurar" (gated por !ehReadOnly e versão != atual), com confirmação
 */
export function HistoricoCalculoDrawer({
  open,
  onOpenChange,
  calculoId,
  calculoAtual,
  ehReadOnly,
}: HistoricoCalculoDrawerProps) {
  const versoesQuery = useCalculoVersoes(calculoId);
  const funcionariosQuery = useFuncionarios();
  const restaurarMutation = useRestaurarVersaoCalculo();
  const { showToast } = useToast();

  const [diffAberto, setDiffAberto] = useState<string | null>(null);
  const [confirmarAlvo, setConfirmarAlvo] = useState<EngenhariaCalculoVersao | null>(null);

  function nomeAutor(autorId: string | null): string {
    if (autorId === null) return 'Sistema';
    const f = funcionariosQuery.data?.find((x) => x.authUserId === autorId);
    return f?.nome ?? '—';
  }

  async function confirmarRestauracao() {
    if (!confirmarAlvo) return;
    const alvo = confirmarAlvo;
    try {
      await restaurarMutation.mutateAsync({
        calculoId,
        versaoAlvo: alvo,
        versaoAtual: calculoAtual.versao,
        tituloAtual: calculoAtual.titulo,
        alertaAtivoAtual: calculoAtual.alertaAtivo,
      });
      showToast({
        kind: 'success',
        message: `Versão v${alvo.versao} restaurada como v${calculoAtual.versao + 1}.`,
      });
      setConfirmarAlvo(null);
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro desconhecido';
      showToast({ kind: 'error', message: `Falha ao restaurar: ${msg}` });
      // Mantém o dialog aberto para o usuário tentar de novo
    }
  }

  const textoAtual = useMemo(
    () => extrairTextoCalculo(calculoAtual.documento),
    [calculoAtual.documento],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-96 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Histórico de versões</SheetTitle>
            <SheetDescription>
              Versões mais recentes primeiro. Restaurar gera uma nova versão.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-200px)] px-4 pb-4">
            {versoesQuery.isLoading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}

            {versoesQuery.isError && (
              <p className="text-sm text-muted-foreground">Falha ao carregar histórico.</p>
            )}

            {versoesQuery.data && versoesQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem versões anteriores.</p>
            )}

            {versoesQuery.data?.map((versao) => {
              const podeRestaurar = !ehReadOnly && versao.versao !== calculoAtual.versao;
              const diffEsteAberto = diffAberto === versao.id;

              return (
                <div
                  key={versao.id}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{versao.versao}</Badge>
                    <span className="text-sm text-foreground">{nomeAutor(versao.autorId)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(versao.criadoEm).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="mt-2">
                    <VersaoPreview documento={versao.documento} />
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => setDiffAberto(diffEsteAberto ? null : versao.id)}
                    >
                      {diffEsteAberto ? 'Fechar diff' : 'Ver diff'}
                    </Button>
                    {podeRestaurar && (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setConfirmarAlvo(versao)}
                        disabled={restaurarMutation.isPending}
                      >
                        Restaurar
                      </Button>
                    )}
                  </div>

                  {diffEsteAberto && (
                    <DiffInline
                      textoAtual={textoAtual}
                      documentoVersao={versao.documento}
                      numeroVersao={versao.versao}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmarAlvo}
        onOpenChange={(o) => {
          if (!o) setConfirmarAlvo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual será preservado no histórico como v{calculoAtual.versao + 1}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restaurarMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarRestauracao();
              }}
              disabled={restaurarMutation.isPending}
            >
              {restaurarMutation.isPending ? 'Restaurando…' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function VersaoPreview({ documento }: { documento: DocumentoCalculo }) {
  const preview = useMemo(() => {
    const texto = extrairTextoCalculo(documento);
    return texto.length > 120 ? `${texto.slice(0, 120).trimEnd()}…` : texto;
  }, [documento]);

  if (!preview) return null;
  return (
    <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
      {preview}
    </p>
  );
}

interface DiffInlineProps {
  textoAtual: string;
  documentoVersao: DocumentoCalculo;
  numeroVersao: number;
}

function DiffInline({ textoAtual, documentoVersao, numeroVersao }: DiffInlineProps) {
  // Lazy: extrai o texto da versão apenas quando o diff é aberto (componente monta).
  const textoVersao = useMemo(() => extrairTextoCalculo(documentoVersao), [documentoVersao]);
  const partes = useMemo(() => diffWords(textoAtual, textoVersao), [textoAtual, textoVersao]);

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 rounded border border-border bg-muted/30 p-2 text-xs">
      <div>
        <p className="mb-1 font-medium text-muted-foreground">Atual</p>
        <div className="whitespace-pre-wrap break-words">
          {partes.map((p, i) => {
            if (p.added) return null;
            if (p.removed) {
              return (
                <span
                  key={i}
                  className="bg-red-100 text-red-900 line-through dark:bg-red-950/40 dark:text-red-200"
                >
                  {p.value}
                </span>
              );
            }
            return (
              <span key={i} className="text-muted-foreground">
                {p.value}
              </span>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1 font-medium text-muted-foreground">v{numeroVersao}</p>
        <div className="whitespace-pre-wrap break-words">
          {partes.map((p, i) => {
            if (p.removed) return null;
            if (p.added) {
              return (
                <span
                  key={i}
                  className="bg-green-100 text-green-900 dark:bg-green-950/40 dark:text-green-200"
                >
                  {p.value}
                </span>
              );
            }
            return (
              <span key={i} className="text-muted-foreground">
                {p.value}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
