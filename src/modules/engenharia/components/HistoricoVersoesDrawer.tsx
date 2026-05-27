import { useState } from 'react';
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
import { useFuncionarios } from '@/hooks/useFuncionarios';
import type { EngenhariaNota, EngenhariaNotaVersao } from '../types/nota';
import { useNotaVersoes, useRestaurarVersao } from '../hooks/useNotaVersoes';

interface HistoricoVersoesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaId: string;
  /** Nota atual para resolver título + número da versão atual (para diff e restauração). */
  notaAtual: EngenhariaNota;
  /** Quando true, esconde botão "Restaurar" (modo somente leitura). */
  ehReadOnly: boolean;
}

/**
 * Drawer lateral (Sheet right) que lista versões de uma nota, com:
 *  - Cabeçalho (badge versão + autor + timestamp + preview ~120 chars)
 *  - "Ver diff" inline (diffWords entre nota atual e a versão escolhida)
 *  - "Restaurar" (gated por !ehReadOnly e versão != atual), com confirmação
 */
export function HistoricoVersoesDrawer({
  open,
  onOpenChange,
  notaId,
  notaAtual,
  ehReadOnly,
}: HistoricoVersoesDrawerProps) {
  const versoesQuery = useNotaVersoes(notaId);
  const funcionariosQuery = useFuncionarios();
  const restaurarMutation = useRestaurarVersao();

  const [diffAberto, setDiffAberto] = useState<string | null>(null);
  const [confirmarAlvo, setConfirmarAlvo] = useState<EngenhariaNotaVersao | null>(null);

  function nomeAutor(autorId: string | null): string {
    if (autorId === null) return 'Sistema';
    const f = funcionariosQuery.data?.find((x) => x.authUserId === autorId);
    return f?.nome ?? '—';
  }

  async function confirmarRestauracao() {
    if (!confirmarAlvo) return;
    try {
      await restaurarMutation.mutateAsync({
        notaId,
        versaoAlvo: confirmarAlvo,
        versaoAtual: notaAtual.versao,
        tituloAtual: notaAtual.titulo,
      });
      setConfirmarAlvo(null);
      onOpenChange(false);
    } catch {
      // Mantém o dialog aberto; UX simples — erro fica visível no botão.
    }
  }

  const textoAtual = extrairTextoPlain(notaAtual.conteudoJson);

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
              const textoVersao = extrairTextoPlain(versao.conteudoJson);
              const preview = textoVersao.slice(0, 120);
              const podeRestaurar = !ehReadOnly && versao.versao !== notaAtual.versao;
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

                  {preview && (
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                      {preview}
                      {textoVersao.length > 120 ? '…' : ''}
                    </p>
                  )}

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
                      textoVersao={textoVersao}
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
              O conteúdo atual será preservado no histórico como v{notaAtual.versao + 1}.
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

interface DiffInlineProps {
  textoAtual: string;
  textoVersao: string;
  numeroVersao: number;
}

function DiffInline({ textoAtual, textoVersao, numeroVersao }: DiffInlineProps) {
  const partes = diffWords(textoAtual, textoVersao);

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

/**
 * Extrai texto puro de um documento ProseMirror (Tiptap JSON).
 * Walk recursivo coletando `text` de nodes folha.
 */
function extrairTextoPlain(json: unknown): string {
  const partes: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (typeof n.text === 'string') {
      partes.push(n.text);
    }
    if (Array.isArray(n.content)) {
      n.content.forEach(walk);
      // Adiciona separador entre blocos para diff legível
      if (n.type && n.type !== 'text') {
        partes.push(' ');
      }
    }
  }

  walk(json);
  return partes.join('').replace(/\s+/g, ' ').trim();
}
