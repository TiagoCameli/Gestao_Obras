import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useEngenhariaCalculo, useSalvarCalculo } from '../hooks/useEngenhariaCalculos';
import { LinhaCalculo as LinhaCalculoComp } from '../components/LinhaCalculo';
import { CalculoToolbar } from '../components/CalculoToolbar';
import { LockBanner } from '../components/LockBanner';
import { HistoricoCalculoDrawer } from '../components/HistoricoCalculoDrawer';
import { recalcularDocumento } from '../services/calcDocumento';
import { novaLinhaVazia, type DocumentoCalculo, type EngenhariaCalculo, type LinhaCalculo } from '../types/calculo';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;

export default function CalculoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [linhas, setLinhas] = useState<LinhaCalculo[]>([]);
  const avaliadas = useMemo(() => recalcularDocumento(linhas), [linhas]);
  const avaliadaPorId = useMemo(
    () => new Map(avaliadas.map((a) => [a.id, a])),
    [avaliadas],
  );
  const [alertaAtivo, setAlertaAtivo] = useState(true);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroEhConflito, setErroEhConflito] = useState(false);
  const [revisadas, setRevisadas] = useState<Set<string>>(new Set());
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const lock = useLockRecurso('calculo', id ?? null);
  const { data: calculo, isLoading } = useEngenhariaCalculo(id ?? '');
  const salvarMutation = useSalvarCalculo();

  const ehDono = lock.status === 'meu';
  const podeEditar = temAcao('editar_engenharia_calculo');
  const readOnly = !podeEditar || !ehDono;

  useEffect(() => {
    if (calculo) {
      setTitulo(calculo.titulo);
      setLinhas(calculo.documento.linhas.length > 0 ? calculo.documento.linhas : [novaLinhaVazia(0)]);
      setAlertaAtivo(calculo.alertaAtivo);
      setRevisadas(new Set());
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculo?.id]);

  const salvar = useCallback(async () => {
    if (!calculo || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    setErroEhConflito(false);
    try {
      const linhasPersistir = linhas.map((l) => {
        const a = avaliadaPorId.get(l.id);
        const ehRevisada = revisadas.has(l.id) || l.alerta === 'revisado';
        return {
          ...l,
          resultado: a?.resultado ?? null,
          alerta: ehRevisada ? ('revisado' as const) : ((a?.alerta ?? 'vazio') as LinhaCalculo['alerta']),
        };
      });
      const documento: DocumentoCalculo = { linhas: linhasPersistir };
      const result = await salvarMutation.mutateAsync({
        id: calculo.id,
        titulo,
        documento,
        alertaAtivo,
        versaoAtual: calculo.versao,
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
      }
    } catch (e) {
      setErroSalvar(`Falha ao salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }, [calculo, readOnly, salvando, salvarMutation, titulo, linhas, alertaAtivo]);

  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void salvar(); }, AUTO_SAVE_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titulo, linhas, alertaAtivo, readOnly, salvar]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (readOnly) return;
        e.preventDefault();
        void salvar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvar, readOnly]);

  const onForcarLiberacao = temAcao('gerenciar_locks_engenharia') && id
    ? async () => {
        const { error } = await supabase
          .from('engenharia_locks')
          .delete()
          .eq('recurso_tipo', 'calculo')
          .eq('recurso_id', id);
        if (error) showToast({ kind: 'error', message: `Falha ao liberar lock: ${error.message}` });
        else showToast({ kind: 'success', message: 'Lock liberado. Tente editar agora.' });
      }
    : undefined;

  function handleLinhaChange(atualizada: LinhaCalculo) {
    setLinhas((prev) => prev.map((l) => (l.id === atualizada.id ? atualizada : l)));
    dirtyRef.current = true;
    setRevisadas((prev) => {
      if (!prev.has(atualizada.id)) return prev;
      const next = new Set(prev);
      next.delete(atualizada.id);
      return next;
    });
  }

  function handleRevisado(linhaId: string) {
    setRevisadas((prev) => new Set(prev).add(linhaId));
    setLinhas((prev) => prev.map((l) => (l.id === linhaId ? { ...l, alerta: 'revisado' as const } : l)));
    dirtyRef.current = true;
  }

  function handleAdicionarLinha() {
    setLinhas((prev) => [...prev, novaLinhaVazia(prev.length)]);
    dirtyRef.current = true;
  }

  function handleToggleAlerta(novo: boolean) {
    setAlertaAtivo(novo);
    dirtyRef.current = true;
  }

  async function handleRecarregar() {
    if (!id) return;
    await qc.refetchQueries({ queryKey: ['engenharia', 'calculos', 'item', id] });
    const fresh = qc.getQueryData<EngenhariaCalculo>(['engenharia', 'calculos', 'item', id]);
    if (fresh) {
      setTitulo(fresh.titulo);
      setLinhas(fresh.documento.linhas.length > 0 ? fresh.documento.linhas : [novaLinhaVazia(0)]);
      setAlertaAtivo(fresh.alertaAtivo);
      setRevisadas(new Set());
      dirtyRef.current = false;
    }
    setErroSalvar(null);
    setErroEhConflito(false);
  }

  if (isLoading || !calculo || !id) {
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
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); dirtyRef.current = true; }}
          disabled={readOnly}
          className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-2"
          placeholder="Título do cálculo"
        />
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-muted-foreground min-w-[60px] text-right"
        >
          {salvando ? 'Salvando…' : (!dirtyRef.current ? 'Salvo' : '')}
        </span>
      </header>

      <LockBanner estado={lock} onForcarLiberacao={onForcarLiberacao} />

      {erroSalvar && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive px-4 py-2 text-sm">
          <span className="flex-1">{erroSalvar}</span>
          {erroEhConflito && (
            <Button size="xs" variant="outline" onClick={handleRecarregar}>
              Recarregar
            </Button>
          )}
        </div>
      )}

      <CalculoToolbar
        alertaAtivo={alertaAtivo}
        onToggleAlerta={handleToggleAlerta}
        onSalvar={() => void salvar()}
        onAbrirHistorico={() => setHistoricoOpen(true)}
        onAdicionarLinha={handleAdicionarLinha}
        desabilitado={readOnly}
        salvando={salvando}
        podeVerHistorico={temAcao('ver_historico_engenharia')}
      />

      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 space-y-1">
        {linhas.map((l) => {
          const avaliada = avaliadaPorId.get(l.id)!;
          return (
            <LinhaCalculoComp
              key={l.id}
              linha={l}
              avaliada={avaliada}
              alertaAtivo={alertaAtivo}
              readOnly={readOnly}
              onChange={handleLinhaChange}
              onRevisado={handleRevisado}
              marcadaRevisada={revisadas.has(l.id) || l.alerta === 'revisado'}
            />
          );
        })}
      </main>

      {temAcao('ver_historico_engenharia') && (
        <HistoricoCalculoDrawer
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          calculoId={calculo.id}
          calculoAtual={calculo}
          ehReadOnly={readOnly}
        />
      )}
    </div>
  );
}
