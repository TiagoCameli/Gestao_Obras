import { ExternalLink, Info } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert';
import { ERP_URL } from '@/utils/modulosMigrados';

/**
 * Faixa no topo de Frete, Combustível e Manutenção: o módulo passou para o ERP-EMT e aqui é
 * só consulta (Fase 5 da migração). Os botões de lançar e editar já não aparecem.
 */
export function AvisoMigradoErp({ modulo, caminho }: { modulo: string; caminho: string }) {
  return (
    <Alert>
      <Info />
      <AlertTitle>{modulo} passou para o ERP-EMT. Aqui fica só para consulta.</AlertTitle>
      <AlertDescription>
        <span>
          Lance e edite no ERP.{' '}
          <a href={`${ERP_URL}${caminho}`} className="inline-flex items-center gap-1 font-medium underline" target="_blank" rel="noreferrer">
            Abrir {modulo} no ERP <ExternalLink className="size-3" />
          </a>
        </span>
      </AlertDescription>
    </Alert>
  );
}
