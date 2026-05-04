// SaidaCombustivelList — lista unificada de saídas de combustível (Fase 4).
//
// Substitui AbastecimentoList + AbastecimentoExternoList. Filtros chip
// internos cobrem o split antigo (Tanque/Dinheiro/Requisição) e o tipo
// de consumidor (Equipamento/Carreta).

import { useMemo, useState } from 'react';
import { Settings2, Truck, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import type {
  SaidaCombustivel,
  TipoConsumidorSaida,
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

type FiltroTipo = 'todos' | TipoConsumidorSaida;
type FiltroOrigem = 'todas' | OrigemCombustivel;

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
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todas');

  // Maps pra resolver nomes
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const equipMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, { nome: e.nome, codigo: e.codigoPatrimonio }])), [equipamentos]);
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const combustMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const filtradas = useMemo(() => {
    return saidas.filter((s) => {
      if (filtroTipo !== 'todos' && s.tipoConsumidor !== filtroTipo) return false;
      if (filtroOrigem !== 'todas' && s.origem !== filtroOrigem) return false;
      return true;
    });
  }, [saidas, filtroTipo, filtroOrigem]);

  const totalLitros = useMemo(() => filtradas.reduce((acc, s) => acc + s.litros, 0), [filtradas]);
  const totalValor = useMemo(() => filtradas.reduce((acc, s) => acc + s.valorTotal, 0), [filtradas]);

  function chip<T extends string>(value: T, label: string, current: T, setter: (v: T) => void, count?: number) {
    const ativo = value === current;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setter(value)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
          ativo
            ? 'bg-emt-verde text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {label}
        {count != null && <span className="ml-1.5 opacity-70">({count})</span>}
      </button>
    );
  }

  // Counts pros chips
  const countsTipo = useMemo(() => {
    const c = { todos: saidas.length, equipamento_proprio: 0, carreta_transportadora: 0 };
    for (const s of saidas) c[s.tipoConsumidor]++;
    return c;
  }, [saidas]);
  const countsOrigem = useMemo(() => {
    const c = { todas: saidas.length, tanque: 0, dinheiro: 0, requisicao: 0 };
    for (const s of saidas) c[s.origem]++;
    return c;
  }, [saidas]);

  return (
    <div className="space-y-4">
      {/* Filtros chips */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Tipo de Consumidor
          </div>
          <div className="flex gap-2 flex-wrap">
            {chip<FiltroTipo>('todos', 'Todos', filtroTipo, setFiltroTipo, countsTipo.todos)}
            {chip<FiltroTipo>('equipamento_proprio', 'Equipamento', filtroTipo, setFiltroTipo, countsTipo.equipamento_proprio)}
            {chip<FiltroTipo>('carreta_transportadora', 'Carreta', filtroTipo, setFiltroTipo, countsTipo.carreta_transportadora)}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Origem
          </div>
          <div className="flex gap-2 flex-wrap">
            {chip<FiltroOrigem>('todas', 'Todas', filtroOrigem, setFiltroOrigem, countsOrigem.todas)}
            {chip<FiltroOrigem>('tanque', 'Tanque', filtroOrigem, setFiltroOrigem, countsOrigem.tanque)}
            {chip<FiltroOrigem>('dinheiro', 'Dinheiro', filtroOrigem, setFiltroOrigem, countsOrigem.dinheiro)}
            {chip<FiltroOrigem>('requisicao', 'Requisição', filtroOrigem, setFiltroOrigem, countsOrigem.requisicao)}
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div className="text-sm text-gray-600 px-1">
        <span className="font-semibold text-gray-800">{filtradas.length}</span> saída{filtradas.length !== 1 ? 's' : ''}
        {' · '}
        <span className="font-semibold">{totalLitros.toLocaleString('pt-BR')} L</span>
        {' · '}
        <span className="font-semibold text-emt-verde-escuro">{fmtBRL(totalValor)}</span>
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
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
              {filtradas.map((s) => {
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
                    <td className="px-3 py-2 text-gray-700 capitalize">{s.origem}</td>
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
