import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import type { LinhaCalculo as TLinha } from '../types/calculo';
import type { LinhaAvaliada } from '../services/calcDocumento';

interface LinhaCalculoProps {
  linha: TLinha;
  /** Resultado da avaliação document-level (vem do CalculoPage). */
  avaliada: LinhaAvaliada;
  alertaAtivo: boolean;
  readOnly: boolean;
  onChange: (atualizada: TLinha) => void;
  onRevisado: (linhaId: string) => void;
  marcadaRevisada: boolean;
}

export function LinhaCalculo({
  linha,
  avaliada,
  alertaAtivo,
  readOnly,
  onChange,
  onRevisado,
  marcadaRevisada,
}: LinhaCalculoProps) {
  const alertaEfetivo = marcadaRevisada ? 'revisado' : avaliada.alerta;
  const mostrarErro = alertaAtivo && alertaEfetivo === 'erro';

  const mostrarGhostResultado =
    avaliada.alerta === 'ok' &&
    avaliada.rhsUsuario === null &&
    avaliada.resultado !== null &&
    avaliada.tipo !== 'vazio' &&
    !mostrarErro;

  function handleChange(novoTexto: string) {
    onChange({ ...linha, expressao: novoTexto });
  }

  function handleBlurAutoFill() {
    if (
      avaliada.tipo === 'avaliacao' &&
      avaliada.alerta === 'ok' &&
      avaliada.rhsUsuario === null &&
      avaliada.resultado !== null
    ) {
      const completo = `${avaliada.lhs}=${avaliada.resultado}`;
      if (linha.expressao !== completo) {
        onChange({ ...linha, expressao: completo });
      }
    }
  }

  return (
    <div
      data-alerta={alertaEfetivo}
      data-tipo={avaliada.tipo}
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
        placeholder="Digite uma expressão (ex: 1+1= ou x=2*2)"
        aria-invalid={mostrarErro || undefined}
      />
      {mostrarGhostResultado && (
        <span className="text-xs text-muted-foreground whitespace-nowrap" aria-hidden>
          = {avaliada.resultado}
        </span>
      )}
      {mostrarErro && (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
          <span className="text-xs text-destructive whitespace-nowrap">
            {avaliada.erroEngine
              ? avaliada.erroEngine
              : avaliada.resultado !== null
                ? `calculado: ${avaliada.resultado}`
                : 'expressão inválida'}
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
