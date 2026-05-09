// SaidaCombustivelList — lista unificada de saídas de combustível.
//
// Substitui AbastecimentoList + AbastecimentoExternoList. Filtros (tipo
// de consumidor, origem, tanque, etc.) vêm da FilterBar global v2 — esta
// lista renderiza apenas o que recebe via prop `saidas`.

import { useMemo } from 'react';
import { Settings2, Truck, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import type {
  SaidaCombustivel,
  OrigemCombustivel,
  Obra,
  Deposito,
  Equipamento,
  Fornecedor,
  Insumo,
} from '../../types';
import Button from '../ui/Button';

interface Props {
  saidas: SaidaCombustivel[];
  obras: Obra[];
  depositos: Deposito[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  onEdit?: (s: SaidaCombustivel) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

// Rótulo display da Origem — enum interno é ASCII ('requisicao'); na UI
// mostra "Requisição" com cedilha (consistente com form).
const ORIGEM_LABEL: Record<OrigemCombustivel, string> = {
  tanque: 'Tanque',
  dinheiro: 'Dinheiro',
  requisicao: 'Requisição',
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string): string {
  if (!iso) return '—';
  // ISO timestamptz → dd/MM/yy HH:mm
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SaidaCombustivelList({
  saidas,
  obras,
  depositos,
  equipamentos,
  transportadoras,
  combustiveis,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: Props) {
  // Maps pra resolver nomes
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, { nome: e.nome, codigo: e.codigoPatrimonio }])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const combustMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const totalLitros = useMemo(() => saidas.reduce((acc, s) => acc + s.litros, 0), [saidas]);
  const totalValor = useMemo(() => saidas.reduce((acc, s) => acc + s.valorTotal, 0), [saidas]);

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="text-sm text-gray-600 px-1">
        <span className="font-semibold text-gray-800">{saidas.length}</span> saída{saidas.length !== 1 ? 's' : ''}
        {' · '}
        <span className="font-semibold">{totalLitros.toLocaleString('pt-BR')} L</span>
        {' · '}
        <span className="font-semibold text-emt-verde-escuro">{fmtBRL(totalValor)}</span>
      </div>

      {/* Tabela */}
      {saidas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center text-gray-500 text-sm">
          Nenhuma saída para os filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Data</th>
                <th className="px-3 py-2 text-left font-semibold">Consumidor</th>
                <th className="px-3 py-2 text-left font-semibold">Origem</th>
                <th className="px-3 py-2 text-left font-semibold">Tanque</th>
                <th className="px-3 py-2 text-left font-semibold">Obra</th>
                <th className="px-3 py-2 text-left font-semibold">Combustível</th>
                <th className="px-3 py-2 text-right font-semibold">Litros</th>
                <th className="px-3 py-2 text-right font-semibold">Valor</th>
                {(canEdit || canDelete) && <th className="px-3 py-2 text-right font-semibold">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {saidas.map((s) => {
                let consumidorNode;
                if (s.tipoConsumidor === 'equipamento_proprio') {
                  if (s.equipamentoId === 'desconhecido') {
                    consumidorNode = (
                      <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="text-xs">Sentinel (legado)</span>
                      </span>
                    );
                  } else {
                    const eq = s.equipamentoId ? equipMap.get(s.equipamentoId) : null;
                    consumidorNode = (
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <Settings2 className="w-3.5 h-3.5" />
                        <span>{eq?.codigo ? `${eq.codigo} — ${eq.nome}` : (eq?.nome ?? '?')}</span>
                      </span>
                    );
                  }
                } else {
                  const transpNome = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '?') : '?';
                  consumidorNode = (
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      <Truck className="w-3.5 h-3.5" />
                      <span>
                        {transpNome}
                        {s.placa ? <span className="text-gray-400"> · {s.placa}</span> : null}
                      </span>
                    </span>
                  );
                }

                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtData(s.data)}</td>
                    <td className="px-3 py-2">{consumidorNode}</td>
                    <td className="px-3 py-2 text-gray-700">{ORIGEM_LABEL[s.origem]}</td>
                    <td className="px-3 py-2 text-gray-700">{s.tanqueId ? (tanquesMap.get(s.tanqueId) ?? '—') : '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{s.obraId ? (obrasMap.get(s.obraId) ?? '—') : '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{combustMap.get(s.tipoCombustivel) ?? s.tipoCombustivel}</td>
                    <td className="px-3 py-2 text-right text-gray-700 font-mono">{s.litros.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right text-gray-800 font-mono font-semibold">{fmtBRL(s.valorTotal)}</td>
                    {(canEdit || canDelete) && (
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          {canEdit && onEdit && (
                            <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => onEdit(s)} aria-label="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDelete && onDelete && (
                            <Button variant="secondary" className="text-xs px-2 py-1 text-red-600 hover:text-red-700" onClick={() => onDelete(s.id)} aria-label="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
