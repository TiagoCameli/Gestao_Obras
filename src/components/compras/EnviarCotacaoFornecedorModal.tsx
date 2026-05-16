/**
 * Modal "Enviar cotação para fornecedor".
 *
 * - Lista os fornecedores que estão na cotação (cards) com canais (whatsapp/email/link)
 * - Para cada fornecedor sem link público válido, gera um novo token
 * - Mostra URL gerada com botão "Copiar" (e botão "Abrir no WhatsApp" se telefone existir)
 * - Mostra status: ⏳ pendente, ✅ respondido (se houver resposta)
 *
 * WhatsApp: monta wa.me/<telefone>?text=<mensagem-encoded> — abre WhatsApp
 * Web/Mobile com texto pronto. Sem provedor pago, ainda manual o envio.
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, Check, MessageCircle, Mail, Link as LinkIcon, RefreshCw, ExternalLink } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
  useCotacaoLinksPublicos,
  useCriarCotacaoLinkPublico,
  useCotacaoRespostas,
} from '../../hooks/useCotacaoLinksPublicos';
import { auditar } from '../../utils/comprasAudit';
import { urlPortalCotacao } from '../../utils/comprasToken';
import type { Cotacao, Fornecedor, CanalEnvioCotacao } from '../../types';

interface Props {
  open: boolean;
  cotacao: Cotacao | null;
  fornecedores: Fornecedor[];
  onClose: () => void;
}

export default function EnviarCotacaoFornecedorModal({
  open, cotacao, fornecedores, onClose,
}: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const cotacaoId = cotacao?.id || '';
  const { data: links = [] } = useCotacaoLinksPublicos(cotacaoId);
  const { data: respostas = [] } = useCotacaoRespostas(cotacaoId);
  const criarLinkMut = useCriarCotacaoLinkPublico();

  const fornecedoresMap = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f])),
    [fornecedores]
  );

  // Lista os fornecedores da cotação que ainda não têm link válido + os que têm
  const linhas = useMemo(() => {
    if (!cotacao) return [];
    return cotacao.fornecedores.map((cf) => {
      const fornecedor = fornecedoresMap.get(cf.fornecedorId);
      const linksFornecedor = links
        .filter((l) => l.fornecedorId === cf.fornecedorId)
        .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
      const linkAtivo = linksFornecedor.find(
        (l) => !l.respondido && new Date(l.expiresAt).getTime() > Date.now()
      );
      const respostaRecebida = respostas.find((r) => r.fornecedorId === cf.fornecedorId);
      return { fornecedor, cotacaoFornecedor: cf, linkAtivo, linksFornecedor, respostaRecebida };
    });
  }, [cotacao, fornecedoresMap, links, respostas]);

  const handleGerar = async (fornecedorId: string, canal: CanalEnvioCotacao) => {
    if (!cotacao) return;
    try {
      const link = await criarLinkMut.mutateAsync({
        cotacaoId: cotacao.id,
        fornecedorId,
        canalEnvio: canal,
        expiraEmDias: 7,
        criadoPor: usuario?.nome || '',
      });
      await auditar({
        entidade: 'cotacao', entidadeId: cotacao.id, acao: 'sent_to_supplier',
        usuarioNome: usuario?.nome || '',
        observacao: `Link gerado para ${fornecedoresMap.get(fornecedorId)?.nome ?? fornecedorId} via ${canal}`,
      });
      showToast({ kind: 'success', message: 'Link gerado. Copie e envie ao fornecedor.' });
      return link.token;
    } catch (e) {
      showToast({ kind: 'error', message: 'Falha ao gerar link: ' + (e as Error).message });
    }
  };

  if (!cotacao) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Enviar cotação ${cotacao.numero} para fornecedores`} size="lg">
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-fg-muted)]">
          Para cada fornecedor, escolha o canal de envio. O sistema gera um <strong>link único e
          assinável</strong> que vence em 7 dias. Copie a URL ou abra direto no WhatsApp/email.
        </p>

        {linhas.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-fg-muted)]">
            Adicione fornecedores à cotação primeiro.
          </div>
        )}

        {linhas.map(({ fornecedor, cotacaoFornecedor, linkAtivo, respostaRecebida }) => (
          <div
            key={cotacaoFornecedor.id}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-[var(--color-fg)] truncate">
                  {fornecedor?.nome ?? 'Fornecedor não encontrado'}
                </h4>
                {fornecedor && (
                  <div className="text-xs text-[var(--color-fg-muted)] flex items-center flex-wrap gap-x-3 mt-0.5">
                    {fornecedor.telefone && <span>📱 {fornecedor.telefone}</span>}
                    {fornecedor.email && <span>✉ {fornecedor.email}</span>}
                  </div>
                )}
              </div>
              <StatusEnvio respostaRecebida={!!respostaRecebida} linkAtivo={!!linkAtivo} />
            </div>

            {/* Link ativo: mostra URL e botões de envio */}
            {linkAtivo ? (
              <LinkAtivoView
                token={linkAtivo.token}
                expiresAt={linkAtivo.expiresAt}
                fornecedor={fornecedor}
                cotacaoNumero={cotacao.numero}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <BotaoCanal
                  canal="whatsapp"
                  fornecedorId={cotacaoFornecedor.fornecedorId}
                  disabled={!fornecedor?.telefone}
                  onGerar={handleGerar}
                />
                <BotaoCanal
                  canal="email"
                  fornecedorId={cotacaoFornecedor.fornecedorId}
                  disabled={!fornecedor?.email}
                  onGerar={handleGerar}
                />
                <BotaoCanal
                  canal="link"
                  fornecedorId={cotacaoFornecedor.fornecedorId}
                  onGerar={handleGerar}
                />
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-end pt-3">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

function StatusEnvio({ respostaRecebida, linkAtivo }: { respostaRecebida: boolean; linkAtivo: boolean }) {
  if (respostaRecebida) {
    return (
      <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Check className="w-3 h-3" /> respondido
      </span>
    );
  }
  if (linkAtivo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
        ⏳ aguardando resposta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 h-6 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
      ainda não enviado
    </span>
  );
}

function BotaoCanal({
  canal, fornecedorId, disabled, onGerar,
}: {
  canal: CanalEnvioCotacao;
  fornecedorId: string;
  disabled?: boolean;
  onGerar: (fornecedorId: string, canal: CanalEnvioCotacao) => Promise<string | undefined>;
}) {
  const Icon = canal === 'whatsapp' ? MessageCircle : canal === 'email' ? Mail : LinkIcon;
  const label = canal === 'whatsapp' ? 'WhatsApp' : canal === 'email' ? 'Email' : 'Só link';
  return (
    <button
      type="button"
      onClick={() => onGerar(fornecedorId, canal)}
      disabled={disabled}
      title={disabled ? 'Cadastro do fornecedor sem este contato' : `Gerar link via ${label}`}
      className={
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ' +
        (disabled
          ? 'border-[var(--color-border)] text-[var(--color-fg-subtle)] bg-[var(--color-surface-2)] cursor-not-allowed'
          : 'border-[var(--color-border)] text-[var(--color-fg)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]')
      }
    >
      <Icon className="w-3.5 h-3.5" /> Gerar via {label}
    </button>
  );
}

function LinkAtivoView({
  token, expiresAt, fornecedor, cotacaoNumero,
}: {
  token: string;
  expiresAt: string;
  fornecedor?: Fornecedor;
  cotacaoNumero: string;
}) {
  const url = urlPortalCotacao(token);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  const copiarUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiado(true);
    }
  };

  const mensagem =
`Olá ${fornecedor?.nome ?? ''}, tudo bem?

A EMT Construtora gostaria de uma cotação (${cotacaoNumero}). Acesse o link abaixo, preencha preços, marca e prazos, assine e envie:

${url}

Prazo de resposta: ${new Date(expiresAt).toLocaleDateString('pt-BR')}.

Obrigado!`;

  const whatsappUrl = fornecedor?.telefone
    ? `https://wa.me/${fornecedor.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(mensagem)}`
    : '';
  const mailtoUrl = fornecedor?.email
    ? `mailto:${fornecedor.email}?subject=${encodeURIComponent('Cotação ' + cotacaoNumero + ' — EMT Construtora')}&body=${encodeURIComponent(mensagem)}`
    : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono text-[11px] text-[var(--color-fg)]">
        <LinkIcon className="w-3 h-3 shrink-0 text-[var(--color-fg-subtle)]" />
        <span className="truncate flex-1">{url}</span>
        <button
          type="button"
          onClick={copiarUrl}
          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium hover:bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          {copiado ? <><Check className="w-3 h-3 text-emerald-600" /> copiado</> : <><Copy className="w-3 h-3" /> copiar</>}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {whatsappUrl && (
          <a
            href={whatsappUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Abrir no WhatsApp <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {mailtoUrl && (
          <a
            href={mailtoUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" /> Abrir email <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button
          type="button"
          onClick={() => window.open(url, '_blank')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors"
          title="Pré-visualizar como fornecedor"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Pré-visualizar
        </button>
      </div>
      <p className="text-[10px] text-[var(--color-fg-subtle)]">
        Vence em {new Date(expiresAt).toLocaleString('pt-BR')}.
      </p>
      <button
        type="button"
        onClick={() => { /* gerar novo link */ }}
        className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg-muted)]"
        title="Mantém o atual; outro link pode ser gerado pelos botões acima"
      >
        <RefreshCw className="w-3 h-3" /> Gerar outro link com canal diferente acima
      </button>
    </div>
  );
}
