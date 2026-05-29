import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { Input } from '@/components/shadcn/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLockRecurso } from '../hooks/useLockRecurso';
import { useEngenhariaPrancha, useSalvarPrancha } from '../hooks/useEngenhariaPranchas';
import { LockBanner } from '../components/LockBanner';
import { PranchaCanvas } from '../components/prancha/PranchaCanvas';
import { DOCUMENTO_VAZIO, type DocumentoPrancha, type EngenhariaPrancha } from '../types/prancha';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;

export default function PranchaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [documento, setDocumento] = useState<DocumentoPrancha>(DOCUMENTO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroEhConflito, setErroEhConflito] = useState(false);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const lock = useLockRecurso('prancha', id ?? null);
  const { data: prancha, isLoading } = useEngenhariaPrancha(id ?? '');
  const salvarMutation = useSalvarPrancha();

  const ehDono = lock.status === 'meu';
  const readOnly = !temAcao('editar_engenharia_prancha') || !ehDono;

  useEffect(() => {
    if (prancha) {
      setTitulo(prancha.titulo);
      setDocumento(prancha.documento);
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prancha?.id]);

  const salvar = useCallback(async () => {
    if (!prancha || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    setErroEhConflito(false);
    try {
      const result = await salvarMutation.mutateAsync({
        id: prancha.id, titulo, documento, versaoAtual: prancha.versao,
      });
      if (!result.ok) {
        const conflito = result.motivo === 'conflito_versao';
        setErroEhConflito(conflito);
        setErroSalvar(conflito
          ? 'Outro usuário salvou no meio. Recarregue para ver as mudanças.'
          : `Falha ao salvar: ${result.motivo}`);
      } else {
        dirtyRef.current = false;
      }
    } catch (e) {
      setErroSalvar(`Falha ao salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }, [prancha, readOnly, salvando, salvarMutation, titulo, documento]);

  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void salvar(); }, AUTO_SAVE_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titulo, documento, readOnly, salvar]);

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

  function handleDocChange(doc: DocumentoPrancha) {
    setDocumento(doc);
    dirtyRef.current = true;
  }

  async function handleRecarregar() {
    if (!id) return;
    await qc.refetchQueries({ queryKey: ['engenharia', 'pranchas', 'item', id] });
    const fresh = qc.getQueryData<EngenhariaPrancha>(['engenharia', 'pranchas', 'item', id]);
    if (fresh) { setTitulo(fresh.titulo); setDocumento(fresh.documento); dirtyRef.current = false; }
    setErroSalvar(null);
    setErroEhConflito(false);
  }

  if (isLoading || !prancha || !id) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
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
          placeholder="Título da prancha"
        />
        <Button size="sm" variant="outline" disabled={readOnly || salvando} onClick={() => void salvar()}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
        <span aria-live="polite" className="text-xs text-muted-foreground min-w-[60px] text-right">
          {salvando ? 'Salvando…' : (!dirtyRef.current ? 'Salvo' : '')}
        </span>
      </header>

      <LockBanner estado={lock} />

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

      <PranchaCanvas documento={documento} readOnly={readOnly} onChange={handleDocChange} />
    </div>
  );
}
