import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { Input } from '@/components/shadcn/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useLockRecurso } from '../hooks/useLockRecurso';
import { useEngenhariaNota, useSalvarNota } from '../hooks/useEngenhariaNotas';
import { NotaEditor } from '../components/NotaEditor';
import { NotaToolbar } from '../components/NotaToolbar';
import { LockBanner } from '../components/LockBanner';
import { HistoricoVersoesDrawer } from '../components/HistoricoVersoesDrawer';
import type { EngenhariaNota } from '../types/nota';
import type { Editor } from '@tiptap/react';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;  // 5 segundos de inatividade

/**
 * Página de edição de uma nota Tiptap.
 *
 * Composição:
 * - useLockRecurso('nota', id): readOnly quando lock não é meu
 * - useEngenhariaNota: carrega título + conteúdo
 * - useSalvarNota: salva via RPC com versão otimista
 * - Auto-save com debounce de 5s após última edição
 * - Atalho Cmd/Ctrl+S
 * - LockBanner com botão "Forçar liberação" (gated por gerenciar_locks_engenharia)
 * - NotaToolbar com formatação + Salvar + Histórico
 * - HistoricoVersoesDrawer gated por ver_historico_engenharia
 */
export default function NotaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState<string>('');
  const [conteudo, setConteudo] = useState<unknown>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroEhConflito, setErroEhConflito] = useState(false);

  const dirtyRef = useRef<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useLockRecurso('nota', id ?? null);
  const { data: nota, isLoading } = useEngenhariaNota(id ?? '');
  const salvarMutation = useSalvarNota();

  const ehDono = lock.status === 'meu';
  const podeEditar = temAcao('editar_engenharia_nota');
  const readOnly = !podeEditar || !ehDono;

  // Carrega título + conteúdo quando a nota muda
  useEffect(() => {
    if (nota) {
      setTitulo(nota.titulo);
      setConteudo(nota.conteudoJson);
      dirtyRef.current = false;
    }
  }, [nota?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = useCallback(async () => {
    if (!nota || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    setErroEhConflito(false);
    try {
      const result = await salvarMutation.mutateAsync({
        id: nota.id,
        titulo,
        conteudoJson: conteudo,
        versaoAtual: nota.versao,
      });
      if (!result.ok) {
        const ehConflito = result.motivo === 'conflito_versao';
        setErroEhConflito(ehConflito);
        setErroSalvar(
          ehConflito
            ? 'Outro usuário salvou no meio. Recarregue para ver as mudanças.'
            : `Falha ao salvar: ${result.motivo}`,
        );
      } else {
        dirtyRef.current = false;
        setErroEhConflito(false);
        setErroSalvar(null);
      }
    } finally {
      setSalvando(false);
    }
  }, [nota, readOnly, salvando, salvarMutation, titulo, conteudo]);

  // Auto-save debounce
  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void salvar();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [titulo, conteudo, readOnly, salvar]);

  // Atalho Cmd/Ctrl+S
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (readOnly) return; // deixa o navegador lidar com Cmd+S quando read-only
        e.preventDefault();
        void salvar();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [salvar, readOnly]);

  // Força liberação de lock (gated por gerenciar_locks_engenharia)
  const onForcarLiberacao = temAcao('gerenciar_locks_engenharia') && id
    ? async () => {
        const { error } = await supabase
          .from('engenharia_locks')
          .delete()
          .eq('recurso_tipo', 'nota')
          .eq('recurso_id', id);
        if (error) {
          showToast({ kind: 'error', message: `Falha ao liberar lock: ${error.message}` });
        } else {
          showToast({ kind: 'success', message: 'Lock liberado. Tente editar agora.' });
          // O useLockRecurso fará polling em ~15s e o status mudará para 'meu'.
        }
      }
    : undefined;

  if (isLoading || !nota || !id) {
    return (
      <div className="p-6 space-y-3 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            dirtyRef.current = true;
          }}
          disabled={readOnly}
          className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-2"
          placeholder="Título da nota"
        />
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-right"
        >
          {salvando ? 'Salvando…' : !dirtyRef.current ? 'Salvo' : ''}
        </span>
      </header>

      <LockBanner estado={lock} onForcarLiberacao={onForcarLiberacao} />

      {erroSalvar && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive px-4 py-2 text-sm">
          <span className="flex-1">{erroSalvar}</span>
          {erroEhConflito && (
            <Button
              size="xs"
              variant="outline"
              onClick={async () => {
                await qc.refetchQueries({ queryKey: ['engenharia', 'notas', 'item', id] });
                const freshNota = qc.getQueryData<EngenhariaNota>([
                  'engenharia',
                  'notas',
                  'item',
                  id,
                ]);
                if (freshNota) {
                  setTitulo(freshNota.titulo);
                  setConteudo(freshNota.conteudoJson);
                  dirtyRef.current = false;
                }
                setErroSalvar(null);
                setErroEhConflito(false);
              }}
            >
              Recarregar
            </Button>
          )}
        </div>
      )}

      <NotaToolbar
        editor={editor}
        desabilitado={readOnly}
        onSalvar={() => void salvar()}
        onAbrirHistorico={() => setHistoricoOpen(true)}
        podeVerHistorico={temAcao('ver_historico_engenharia')}
        salvando={salvando}
      />

      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full">
        <NotaEditor
          conteudoInicial={conteudo}
          readOnly={readOnly}
          pastaId={nota.pastaId}
          onChange={(json) => {
            setConteudo(json);
            dirtyRef.current = true;
          }}
          onReadyEditor={setEditor}
          onPasteError={(msg) => showToast({ kind: 'error', message: msg })}
        />
      </main>

      {temAcao('ver_historico_engenharia') && (
        <HistoricoVersoesDrawer
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          notaId={nota.id}
          notaAtual={nota}
          ehReadOnly={readOnly}
        />
      )}
    </div>
  );
}
