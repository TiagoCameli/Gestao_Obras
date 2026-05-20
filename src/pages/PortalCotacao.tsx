/**
 * Portal público do fornecedor para responder uma cotação.
 *
 * Rota: /cotacao/r/:token
 * Sem autenticação — valida só o token (existe + não expirado + não respondido).
 *
 * Fluxo:
 *  1. Busca o link pelo token; se inválido/expirado/respondido, mostra estado correspondente
 *  2. Carrega a cotação + dados do fornecedor (read-only)
 *  3. Mostra formulário de resposta: tabela de itens (preço unitário + marca), condição
 *     de pagamento, prazo de entrega, observações, assinatura (canvas)
 *  4. Ao enviar: insert em cotacao_respostas_fornecedor + update no link
 *  5. Sucesso: tela de "obrigado" — sem opção de reabrir
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Clock, FileText, Eraser, Send } from 'lucide-react';
import {
  useCotacaoPublica,
  useEnviarRespostaCotacao,
} from '../hooks/useCotacaoLinksPublicos';
import type { CotacaoRespostaItem } from '../types';

export default function PortalCotacao() {
  const { token = '' } = useParams<{ token: string }>();
  const { data: portal, isLoading: loadingLink } = useCotacaoPublica(token);
  const link = portal?.link ?? null;
  const cotacao = portal?.cotacao ?? null;
  const fornecedor = portal?.fornecedor ?? null;

  const enviarMut = useEnviarRespostaCotacao();
  // Estado de respostas armazenado por itemId (evita useEffect+setState para
  // sincronizar com a cotação carregada — derivamos no render direto do Map).
  const [respostasMap, setRespostasMap] = useState<Map<string, { precoUnitario: number; marca: string }>>(
    () => new Map()
  );
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | undefined>();
  const [enviado, setEnviado] = useState(false);

  const lerResposta = (itemId: string) =>
    respostasMap.get(itemId) ?? { precoUnitario: 0, marca: '' };
  const atualizarResposta = (itemId: string, patch: Partial<{ precoUnitario: number; marca: string }>) => {
    setRespostasMap((prev) => {
      const novo = new Map(prev);
      const atual = novo.get(itemId) ?? { precoUnitario: 0, marca: '' };
      novo.set(itemId, { ...atual, ...patch });
      return novo;
    });
  };

  // ── Estados de tela ────────────────────────────────────────────────────
  // O RPC `get_cotacao_publica` valida expiração/respondido server-side
  // e retorna reason. Não checamos client-side — submit também re-valida.
  if (loadingLink) {
    return <PortalShell><div className="text-center text-slate-500 py-16">Carregando cotação…</div></PortalShell>;
  }
  if (portal?.reason === 'expired') {
    return <PortalErrorState icon={Clock} titulo="Cotação expirada" mensagem={`Esta cotação venceu${link?.expiresAt ? ' em ' + new Date(link.expiresAt).toLocaleString('pt-BR') : ''}. Entre em contato com o comprador para renovar.`} />;
  }
  if (portal?.reason === 'respondido' || enviado) {
    return <PortalSuccessState />;
  }
  if (!link || !cotacao) {
    return <PortalErrorState icon={AlertTriangle} titulo="Link inválido" mensagem="Esse link de cotação não existe ou foi removido." />;
  }

  const total = cotacao.itensPedido.reduce((sum, item) => {
    const r = lerResposta(item.id);
    return sum + (Number(r.precoUnitario || 0) * Number(item.quantidade || 0));
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const itensResposta: CotacaoRespostaItem[] = cotacao.itensPedido.map((it) => {
      const r = lerResposta(it.id);
      return { itemPedidoId: it.id, precoUnitario: r.precoUnitario, marca: r.marca };
    });
    try {
      await enviarMut.mutateAsync({
        token, itensResposta, condicaoPagamento, prazoEntrega, observacoes, assinaturaBase64,
      });
      setEnviado(true);
    } catch (err) {
      alert('Falha ao enviar resposta: ' + (err as Error).message);
    }
  };

  return (
    <PortalShell>
      <header className="mb-8 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-sm">
            <FileText className="w-5 h-5" />
          </span>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">EMT Construtora</div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Cotação {cotacao.numero}
            </h1>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Olá, <strong>{fornecedor?.nome ?? 'fornecedor'}</strong> 👋 — preencha os preços e a marca
          de cada item, suas condições, e envie no fim da página. Prazo: até{' '}
          <strong>{new Date(link.expiresAt).toLocaleDateString('pt-BR')}</strong>.
        </p>
        {(cotacao.descricao || cotacao.descricaoLivre) && (
          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
            {cotacao.descricao && <div className="font-medium">{cotacao.descricao}</div>}
            {cotacao.descricaoLivre && <div className="mt-1 whitespace-pre-line">{cotacao.descricaoLivre}</div>}
          </div>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabela de itens */}
        <section>
          <h2 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Itens</h2>
          {cotacao.itensPedido.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Esta cotação não tem itens listados — preencha sua proposta nas observações abaixo.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right w-20">Qtd</th>
                    <th className="px-3 py-2 text-left w-16">Un</th>
                    <th className="px-3 py-2 text-left w-40">Marca</th>
                    <th className="px-3 py-2 text-right w-32">Preço unit.</th>
                    <th className="px-3 py-2 text-right w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotacao.itensPedido.map((item) => {
                    const resp = lerResposta(item.id);
                    const subtotal = resp.precoUnitario * (item.quantidade ?? 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 text-slate-900">{item.descricao}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{item.quantidade}</td>
                        <td className="px-3 py-2 text-slate-500">{item.unidade}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={resp.marca}
                            onChange={(e) => atualizarResposta(item.id, { marca: e.target.value })}
                            placeholder="—"
                            className="w-full px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={resp.precoUnitario}
                            onChange={(e) => atualizarResposta(item.id, { precoUnitario: Number(e.target.value) })}
                            className="w-full px-2 py-1 text-sm text-right border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-900 font-medium">
                          {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Total</td>
                    <td className="px-3 py-2 text-right text-base font-bold text-slate-900 tabular-nums">
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Condições + observações */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Condição de pagamento">
            <input
              type="text"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              placeholder="Ex.: 30/60 dias boleto"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </Field>
          <Field label="Prazo de entrega">
            <input
              type="text"
              value={prazoEntrega}
              onChange={(e) => setPrazoEntrega(e.target.value)}
              placeholder="Ex.: 5 dias úteis após pedido"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Observações (opcional)">
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Detalhes, ressalvas, alternativas…"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-y"
              />
            </Field>
          </div>
        </section>

        {/* Assinatura */}
        <section>
          <h2 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">Assinatura</h2>
          <p className="text-xs text-slate-500 mb-2">Assine no espaço abaixo (mouse no desktop, dedo no celular).</p>
          <SignaturePad value={assinaturaBase64} onChange={setAssinaturaBase64} />
        </section>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500 flex-1">
            Ao enviar, você confirma os preços e prazos preenchidos. O comprador receberá uma notificação automática.
          </p>
          <button
            type="submit"
            disabled={enviarMut.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            {enviarMut.isPending ? 'Enviando…' : 'Enviar resposta'}
          </button>
        </div>
      </form>
    </PortalShell>
  );
}


// ─── Layout / componentes auxiliares ─────────────────────────────────────

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-5 sm:px-8 py-6 sm:py-8">
          {children}
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          EMT Construtora · Portal de Cotações
        </p>
      </main>
    </div>
  );
}

function PortalErrorState({
  icon: Icon, titulo, mensagem,
}: { icon: typeof AlertTriangle; titulo: string; mensagem: string }) {
  return (
    <PortalShell>
      <div className="text-center py-10">
        <Icon className="w-12 h-12 mx-auto text-amber-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900 mb-1">{titulo}</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">{mensagem}</p>
      </div>
    </PortalShell>
  );
}

function PortalSuccessState() {
  return (
    <PortalShell>
      <div className="text-center py-10">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600 mb-3" />
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Resposta enviada!</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Sua proposta foi recebida. O comprador da EMT entrará em contato em breve. Obrigado!
        </p>
      </div>
    </PortalShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 uppercase tracking-wide mb-1.5">{label}</span>
      {children}
    </label>
  );
}

// ─── Pad de assinatura (canvas) ──────────────────────────────────────────
function SignaturePad({
  value, onChange,
}: { value?: string; onChange: (b64: string | undefined) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const desenhandoRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [vazio, setVazio] = useState(!value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Resize com DPR pra ficar nítido
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
    }
    // Restaura assinatura existente
    if (value) {
      const img = new Image();
      img.onload = () => ctx?.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    desenhandoRef.current = true;
    lastRef.current = pos(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhandoRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current!.x, lastRef.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (vazio) setVazio(false);
  };
  const onUp = () => {
    desenhandoRef.current = false;
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };
  const limpar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setVazio(true);
    onChange(undefined);
  };

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="block w-full h-40 touch-none cursor-crosshair"
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-xs text-slate-400">
          {vazio ? 'Toque/clique para assinar' : '✓ assinatura registrada'}
        </p>
        <button
          type="button"
          onClick={limpar}
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 transition-colors"
        >
          <Eraser className="w-3 h-3" /> Limpar
        </button>
      </div>
    </div>
  );
}
