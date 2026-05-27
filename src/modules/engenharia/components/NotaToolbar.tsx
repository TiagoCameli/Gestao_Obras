import type { Editor } from '@tiptap/react';
// Side-effect imports para augmentation do tipo `ChainedCommands` (toggleBold, setLink, etc.).
// O NotaEditor monta o editor com estas extensões — aqui só carregamos os .d.ts.
import type {} from '@tiptap/starter-kit';
import type {} from '@tiptap/extension-link';
import type {} from '@tiptap/extension-image';
import type {} from '@tiptap/extension-table';
import type {} from '@tiptap/extension-task-list';
import type {} from '@tiptap/extension-text-align';
import type {} from '@tiptap/extension-highlight';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  History,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Save,
  Strikethrough,
  Table as TableIcon,
  Underline,
} from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { cn } from '@/lib/utils';

interface NotaToolbarProps {
  editor: Editor | null;
  /** Quando true, exibe a toolbar mas desabilita interação (pointer-events-none). */
  desabilitado: boolean;
  onSalvar: () => void;
  onAbrirHistorico: () => void;
  podeVerHistorico: boolean;
  salvando: boolean;
}

/**
 * Toolbar do editor Tiptap.
 *
 * - Marks: bold, italic, underline, strike
 * - Headings: H1, H2, H3
 * - Listas: bullet, ordered, task
 * - Insert: link, image, table
 * - Align: left, center, right
 * - Block: code block, highlight
 * - Actions: Salvar (Cmd+S), Histórico (gated por podeVerHistorico)
 *
 * Quando editor é null, renderiza apenas as ações (Salvar + Histórico)
 * para que o usuário sempre tenha acesso a elas mesmo durante o boot do editor.
 */
export function NotaToolbar({
  editor,
  desabilitado,
  onSalvar,
  onAbrirHistorico,
  podeVerHistorico,
  salvando,
}: NotaToolbarProps) {
  const acoes = (
    <div className="ml-auto flex items-center gap-1">
      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />
      <Button
        type="button"
        size="sm"
        variant="default"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onSalvar}
        disabled={desabilitado || salvando}
        title="Salvar (Cmd+S)"
      >
        <Save />
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
      {podeVerHistorico && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onAbrirHistorico}
        >
          <History />
          Histórico
        </Button>
      )}
    </div>
  );

  if (!editor) {
    return (
      <div className="flex items-center gap-1 border-b border-border bg-background px-2 py-1">
        {acoes}
      </div>
    );
  }

  const isAtivo = (chave: string, attrs?: Record<string, unknown>): boolean => {
    return attrs ? editor.isActive(chave, attrs) : editor.isActive(chave);
  };

  function toolbarBtn(props: {
    chaveAtivo?: string;
    chaveAttrs?: Record<string, unknown>;
    onClick: () => void;
    title: string;
    icon: React.ReactNode;
  }) {
    const ativo = props.chaveAtivo ? isAtivo(props.chaveAtivo, props.chaveAttrs) : false;
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onMouseDown={(e) => e.preventDefault()}
        onClick={props.onClick}
        title={props.title}
        data-active={ativo ? 'true' : undefined}
        className={cn(ativo && 'bg-accent text-accent-foreground')}
      >
        {props.icon}
      </Button>
    );
  }

  const handleInserirLink = () => {
    const href = window.prompt('URL do link:');
    if (!href) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const handleInserirImagem = () => {
    const src = window.prompt('URL da imagem:');
    if (!src) return;
    editor.chain().focus().setImage({ src }).run();
  };

  const handleInserirTabela = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const conteudo = (
    <>
      {/* Marks */}
      {toolbarBtn({
        chaveAtivo: 'bold',
        onClick: () => editor.chain().focus().toggleBold().run(),
        title: 'Negrito',
        icon: <Bold />,
      })}
      {toolbarBtn({
        chaveAtivo: 'italic',
        onClick: () => editor.chain().focus().toggleItalic().run(),
        title: 'Itálico',
        icon: <Italic />,
      })}
      {toolbarBtn({
        chaveAtivo: 'underline',
        onClick: () => editor.chain().focus().toggleUnderline().run(),
        title: 'Sublinhado',
        icon: <Underline />,
      })}
      {toolbarBtn({
        chaveAtivo: 'strike',
        onClick: () => editor.chain().focus().toggleStrike().run(),
        title: 'Tachado',
        icon: <Strikethrough />,
      })}

      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />

      {/* Headings */}
      {toolbarBtn({
        chaveAtivo: 'heading',
        chaveAttrs: { level: 1 },
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        title: 'Título 1',
        icon: <Heading1 />,
      })}
      {toolbarBtn({
        chaveAtivo: 'heading',
        chaveAttrs: { level: 2 },
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        title: 'Título 2',
        icon: <Heading2 />,
      })}
      {toolbarBtn({
        chaveAtivo: 'heading',
        chaveAttrs: { level: 3 },
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        title: 'Título 3',
        icon: <Heading3 />,
      })}

      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />

      {/* Lists */}
      {toolbarBtn({
        chaveAtivo: 'bulletList',
        onClick: () => editor.chain().focus().toggleBulletList().run(),
        title: 'Lista',
        icon: <List />,
      })}
      {toolbarBtn({
        chaveAtivo: 'orderedList',
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
        title: 'Lista numerada',
        icon: <ListOrdered />,
      })}
      {toolbarBtn({
        chaveAtivo: 'taskList',
        onClick: () => editor.chain().focus().toggleTaskList().run(),
        title: 'Lista de tarefas',
        icon: <ListChecks />,
      })}

      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />

      {/* Insert */}
      {toolbarBtn({
        chaveAtivo: 'link',
        onClick: handleInserirLink,
        title: 'Link',
        icon: <Link2 />,
      })}
      {toolbarBtn({
        onClick: handleInserirImagem,
        title: 'Imagem',
        icon: <ImageIcon />,
      })}
      {toolbarBtn({
        onClick: handleInserirTabela,
        title: 'Tabela',
        icon: <TableIcon />,
      })}

      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />

      {/* Align */}
      {toolbarBtn({
        chaveAtivo: 'textAlign',
        chaveAttrs: { textAlign: 'left' },
        onClick: () => editor.chain().focus().setTextAlign('left').run(),
        title: 'Alinhar à esquerda',
        icon: <AlignLeft />,
      })}
      {toolbarBtn({
        chaveAtivo: 'textAlign',
        chaveAttrs: { textAlign: 'center' },
        onClick: () => editor.chain().focus().setTextAlign('center').run(),
        title: 'Centralizar',
        icon: <AlignCenter />,
      })}
      {toolbarBtn({
        chaveAtivo: 'textAlign',
        chaveAttrs: { textAlign: 'right' },
        onClick: () => editor.chain().focus().setTextAlign('right').run(),
        title: 'Alinhar à direita',
        icon: <AlignRight />,
      })}

      <span className="mx-1 h-5 border-l border-border" aria-hidden="true" />

      {/* Block */}
      {toolbarBtn({
        chaveAtivo: 'codeBlock',
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
        title: 'Bloco de código',
        icon: <Code />,
      })}
      {toolbarBtn({
        chaveAtivo: 'highlight',
        onClick: () => editor.chain().focus().toggleHighlight().run(),
        title: 'Destacar',
        icon: <Highlighter />,
      })}

      {acoes}
    </>
  );

  if (desabilitado) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1 opacity-50 pointer-events-none"
      >
        {conteudo}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background px-2 py-1">
      {conteudo}
    </div>
  );
}
