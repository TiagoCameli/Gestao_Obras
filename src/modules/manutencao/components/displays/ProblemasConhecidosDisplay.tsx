import MarkdownDisplay from './MarkdownDisplay';

export interface ProblemasConhecidosDisplayProps {
  markdown: string;
  className?: string;
}

export function ProblemasConhecidosDisplay({
  markdown,
  className = '',
}: ProblemasConhecidosDisplayProps) {
  if (!markdown.trim()) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhum problema cadastrado.
      </p>
    );
  }
  return <MarkdownDisplay markdown={markdown} className={className} />;
}

export default ProblemasConhecidosDisplay;
