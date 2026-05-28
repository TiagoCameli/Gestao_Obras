import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { useEffect, useRef } from 'react';
import { uploadArquivo, getSignedUrl } from '../services/arquivosService';

interface NotaEditorProps {
  conteudoInicial: unknown;
  readOnly: boolean;
  /** Pasta-alvo para uploads de imagem coladas inline. */
  pastaId: string;
  onChange: (conteudoJson: unknown) => void;
  onReadyEditor?: (editor: ReturnType<typeof useEditor>) => void;
  /**
   * Callback opcional para erro ao colar imagem (upload ou signed URL).
   * Caller (NotaPage) deve plugar em showToast — fallback é console.error.
   */
  onPasteError?: (mensagem: string) => void;
}

/**
 * Editor Tiptap para o corpo da nota.
 *
 * Extensões: StarterKit + Image, Link, Table (resizable), TextAlign,
 * Highlight e TaskList/TaskItem.
 *
 * Paste de imagem: detecta image/* no clipboard, sobe via
 * arquivosService.uploadArquivo, busca signed URL e insere no editor.
 * Erros disparam onPasteError (ou console.error).
 *
 * setEditable reage a mudança externa de readOnly (ex.: lock pulou
 * para outro usuário).
 */
export function NotaEditor({
  conteudoInicial,
  readOnly,
  pastaId,
  onChange,
  onReadyEditor,
  onPasteError,
}: NotaEditorProps) {
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const reportError =
    onPasteError ??
    ((mensagem: string) => {
      // eslint-disable-next-line no-console
      console.error(mensagem);
    });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: conteudoInicial as never,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none px-6 py-4',
      },
      handlePaste: (_view, event) => {
        // Detecta imagem no clipboard
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        void (async () => {
          const result = await uploadArquivo({ pastaId, file });
          if (!result.ok) {
            reportError(`Upload de imagem colada falhou: ${result.motivo}`);
            return;
          }
          const url = await getSignedUrl(result.arquivoId).catch((err) => {
            reportError(
              `Falha ao obter URL da imagem: ${err instanceof Error ? err.message : 'erro desconhecido'}`,
            );
            return null;
          });
          if (!url) return;
          const currentEditor = editorRef.current;
          if (!currentEditor) {
            reportError('Editor não inicializado — imagem subiu mas não foi inserida.');
            return;
          }
          currentEditor.chain().focus().setImage({ src: url, alt: file.name }).run();
        })();
        return true;
      },
    },
  });

  // Mantém ref sincronizado com a instância mais recente do editor
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && onReadyEditor) onReadyEditor(editor);
  }, [editor, onReadyEditor]);

  // Reflete mudança de readOnly externo (ex.: lock foi pra outro user)
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return <EditorContent editor={editor} />;
}
