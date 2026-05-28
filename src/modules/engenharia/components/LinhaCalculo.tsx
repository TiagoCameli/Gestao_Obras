import { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { parseLinha } from '../services/calcEngine';
import type { LinhaCalculo as TLinha } from '../types/calculo';

interface LinhaCalculoProps {
  linha: TLinha;
  alertaAtivo: boolean;
  readOnly: boolean;
  onChange: (atualizada: TLinha) => void;
  onRevisado: (linhaId: string) => void;
  /** Quando true (após o user clicar Alerta revisado) sobrescreve `alerta` desta linha como `revisado`. */
  marcadaRevisada: boolean;
}

export function LinhaCalculo({
  linha,
  alertaAtivo,
  readOnly,
  onChange,
  onRevisado,
  marcadaRevisada,
}: LinhaCalculoProps) {
  // Reavalia a linha on-render (parser puro, sem efeitos colaterais)
  const parsed = useMemo(() => parseLinha(linha.expressao), [linha.expressao]);
  const alertaEfetivo = marcadaRevisada ? 'revisado' : parsed.alerta;

  const mostrarErro = alertaAtivo && alertaEfetivo === 'erro';

  // Resultado pendente de uma linha `1+1=` (RHS vazio): exibido como ghost text à
  // direita do input, SEM hijack do value (input é puro controlado em linha.expressao).
  const mostrarGhostResultado =
    parsed.alerta === 'ok' &&
    parsed.rhsUsuario === null &&
    parsed.resultado !== null &&
    !mostrarErro;

  function handleChange(novoTexto: string) {
    const novoParsed = parseLinha(novoTexto);
    onChange({
      ...linha,
      expressao: novoTexto,
      resultado: novoParsed.resultado,
      alerta: novoParsed.alerta,
    });
  }

  function handleBlurAutoFill() {
    // Quando user sai do input e a linha tipo `1+1=`, persiste o resultado preenchido.
    // Re-parseia fresh a partir de linha.expressao (evita stale closure do render).
    const atual = parseLinha(linha.expressao);
    if (atual.alerta === 'ok' && atual.rhsUsuario === null && atual.resultado !== null) {
      const completo = `${atual.lhs}=${atual.resultado}`;
      if (linha.expressao !== completo) {
        onChange({ ...linha, expressao: completo, resultado: atual.resultado, alerta: 'ok' });
      }
    }
  }

  return (
    <div
      data-alerta={alertaEfetivo}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-md border',
        mostrarErro
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-transparent hover:bg-muted/40',
      ].join(' ')}
    >
      <Input
        value={linha.expressao}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlurAutoFill}
        disabled={readOnly}
        className="font-mono text-sm border-none shadow-none focus-visible:ring-0 px-0 bg-transparent"
        placeholder="Digite uma expressão (ex: 1+1=)"
        aria-invalid={mostrarErro || undefined}
      />
      {mostrarGhostResultado && (
        <span className="text-xs text-muted-foreground whitespace-nowrap" aria-hidden>
          = {parsed.resultado}
        </span>
      )}
      {mostrarErro && (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
          <span className="text-xs text-destructive whitespace-nowrap">
            {parsed.resultado !== null ? `calculado: ${parsed.resultado}` : 'expressão inválida'}
          </span>
          {!readOnly && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onRevisado(linha.id)}
              className="border-destructive/30"
            >
              Alerta revisado
            </Button>
          )}
        </>
      )}
      {alertaAtivo && alertaEfetivo === 'revisado' && (
        <Check className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Revisado" />
      )}
    </div>
  );
}
