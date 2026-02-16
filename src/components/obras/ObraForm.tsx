import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { Deposito, EtapaObra, Obra, UnidadeMedida } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportEtapasModal from './ImportEtapasModal';

interface ObraFormProps {
  initial?: Obra | null;
  initialEtapas?: EtapaObra[];
  initialDepositos?: Deposito[];
  onSubmit: (obra: Obra, etapas: EtapaObra[], depositos: Deposito[]) => void;
  onCancel: () => void;
  unidades: UnidadeMedida[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const STATUS_OPTIONS = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluida' },
  { value: 'pausada', label: 'Pausada' },
];

export default function ObraForm({
  initial,
  initialEtapas = [],
  initialDepositos = [],
  onSubmit,
  onCancel,
  unidades,
}: ObraFormProps) {
  const [nome, setNome] = useState(initial?.nome || '');
  const [endereco, setEndereco] = useState(initial?.endereco || '');
  const [status, setStatus] = useState(initial?.status || 'planejamento');
  const [dataInicio, setDataInicio] = useState(initial?.dataInicio || '');
  const [dataPrevisaoFim, setDataPrevisaoFim] = useState(
    initial?.dataPrevisaoFim || ''
  );
  const [responsavel, setResponsavel] = useState(initial?.responsavel || '');
  const [obraId] = useState(() => initial?.id || gerarId());

  // Etapas
  const [etapas, setEtapas] = useState<EtapaObra[]>(initialEtapas);
  const [novaEtapa, setNovaEtapa] = useState('');
  const [novaEtapaUnidade, setNovaEtapaUnidade] = useState('');
  const [novaEtapaQtd, setNovaEtapaQtd] = useState('');
  const [novaEtapaValorUnit, setNovaEtapaValorUnit] = useState('');
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null);
  const [editandoEtapaNome, setEditandoEtapaNome] = useState('');
  const [editandoEtapaUnidade, setEditandoEtapaUnidade] = useState('');
  const [editandoEtapaQtd, setEditandoEtapaQtd] = useState('');
  const [editandoEtapaValorUnit, setEditandoEtapaValorUnit] = useState('');

  const orcamentoCalculado = useMemo(
    () => etapas.reduce((sum, e) => sum + (e.quantidade * e.valorUnitario), 0),
    [etapas]
  );

  // Depositos
  const [depositos, setDepositos] = useState<Deposito[]>(initialDepositos);
  const [novoDepNome, setNovoDepNome] = useState('');
  const [novoDepCapacidade, setNovoDepCapacidade] = useState('');
  const [novoDepNivel, setNovoDepNivel] = useState('');
  const [editandoDepId, setEditandoDepId] = useState<string | null>(null);
  const [editandoDepNome, setEditandoDepNome] = useState('');
  const [editandoDepCapacidade, setEditandoDepCapacidade] = useState('');
  const [editandoDepNivel, setEditandoDepNivel] = useState('');

  const unidadeOptions = useMemo(
    () => unidades.filter((u) => u.ativo).map((u) => ({ value: u.sigla, label: u.nome })),
    [unidades]
  );

  // Import modal
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleImportEtapas = useCallback(
    (novas: EtapaObra[]) => {
      setEtapas((prev) => [...prev, ...novas]);
      setToastMsg(`${novas.length} etapa${novas.length !== 1 ? 's' : ''} importada${novas.length !== 1 ? 's' : ''} com sucesso`);
      setTimeout(() => setToastMsg(''), 4000);
    },
    []
  );

  // --- Etapas handlers ---
  function adicionarEtapa() {
    const nome = novaEtapa.trim();
    if (!nome || !novaEtapaUnidade || !novaEtapaQtd || !novaEtapaValorUnit) return;
    setEtapas([
      ...etapas,
      {
        id: gerarId(),
        nome,
        obraId,
        unidade: novaEtapaUnidade,
        quantidade: parseFloat(novaEtapaQtd) || 0,
        valorUnitario: parseFloat(novaEtapaValorUnit) || 0,
      },
    ]);
    setNovaEtapa('');
    setNovaEtapaUnidade('');
    setNovaEtapaQtd('');
    setNovaEtapaValorUnit('');
  }

  function removerEtapa(id: string) {
    setEtapas(etapas.filter((e) => e.id !== id));
  }

  function iniciarEdicaoEtapa(etapa: EtapaObra) {
    setEditandoEtapaId(etapa.id);
    setEditandoEtapaNome(etapa.nome);
    setEditandoEtapaUnidade(etapa.unidade || '');
    setEditandoEtapaQtd(etapa.quantidade?.toString() || '');
    setEditandoEtapaValorUnit(etapa.valorUnitario?.toString() || '');
  }

  function salvarEdicaoEtapa() {
    if (!editandoEtapaNome.trim()) return;
    setEtapas(
      etapas.map((e) =>
        e.id === editandoEtapaId
          ? {
              ...e,
              nome: editandoEtapaNome.trim(),
              unidade: editandoEtapaUnidade,
              quantidade: parseFloat(editandoEtapaQtd) || 0,
              valorUnitario: parseFloat(editandoEtapaValorUnit) || 0,
            }
          : e
      )
    );
    setEditandoEtapaId(null);
    setEditandoEtapaNome('');
  }

  // --- Depositos handlers ---
  function adicionarDeposito() {
    const nome = novoDepNome.trim();
    const capacidade = parseFloat(novoDepCapacidade);
    const nivel = parseFloat(novoDepNivel) || 0;
    if (!nome || !capacidade) return;
    setDepositos([
      ...depositos,
      {
        id: gerarId(),
        nome,
        obraId,
        capacidadeLitros: capacidade,
        nivelAtualLitros: Math.min(nivel, capacidade),
        ativo: true,
      },
    ]);
    setNovoDepNome('');
    setNovoDepCapacidade('');
    setNovoDepNivel('');
  }

  function removerDeposito(id: string) {
    setDepositos(depositos.filter((d) => d.id !== id));
  }

  function iniciarEdicaoDeposito(dep: Deposito) {
    setEditandoDepId(dep.id);
    setEditandoDepNome(dep.nome);
    setEditandoDepCapacidade(dep.capacidadeLitros.toString());
    setEditandoDepNivel(dep.nivelAtualLitros.toString());
  }

  function salvarEdicaoDeposito() {
    if (!editandoDepNome.trim() || !editandoDepCapacidade) return;
    const cap = parseFloat(editandoDepCapacidade);
    const niv = Math.min(parseFloat(editandoDepNivel) || 0, cap);
    setDepositos(
      depositos.map((d) =>
        d.id === editandoDepId
          ? { ...d, nome: editandoDepNome.trim(), capacidadeLitros: cap, nivelAtualLitros: niv }
          : d
      )
    );
    setEditandoDepId(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const obra: Obra = {
      id: obraId,
      nome,
      endereco,
      status: status as Obra['status'],
      dataInicio,
      dataPrevisaoFim,
      responsavel,
      orcamento: orcamentoCalculado,
    };
    onSubmit(obra, etapas, depositos);
  }

  const isValid = nome && endereco && dataInicio && dataPrevisaoFim && responsavel;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Dados da obra */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Dados da Obra
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome da Obra"
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Residencial Aurora"
            required
          />
          <Input
            label="Endereco"
            id="endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Ex: Rua das Flores, 100"
            required
          />
          <Select
            label="Status"
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Obra['status'])}
            options={STATUS_OPTIONS}
            placeholder="Selecione o status"
            required
          />
          <Input
            label="Responsavel"
            id="responsavel"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Ex: Carlos Silva"
            required
          />
          <Input
            label="Data de Inicio"
            id="dataInicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
          />
          <Input
            label="Previsao de Termino"
            id="dataPrevisaoFim"
            type="date"
            value={dataPrevisaoFim}
            onChange={(e) => setDataPrevisaoFim(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orcamento (R$)
            </label>
            <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-semibold text-emt-verde-escuro">
              {formatCurrency(orcamentoCalculado)}
            </div>
            <p className="text-xs text-gray-400 mt-1">Calculado automaticamente pela soma das etapas</p>
          </div>
        </div>
      </div>

      {/* Etapas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Etapas da Obra
          </h3>
          <Button
            type="button"
            variant="secondary"
            className="text-xs px-3 py-1.5"
            onClick={() => setImportModalOpen(true)}
          >
            Importar do Excel
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <input
            type="text"
            className="md:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Nome da etapa (Ex: Fundacao, Estrutura...)"
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            value={novaEtapaUnidade}
            onChange={(e) => setNovaEtapaUnidade(e.target.value)}
          >
            <option value="">Unidade</option>
            {unidadeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            type="number"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Quantidade"
            step="0.01"
            min="0"
            value={novaEtapaQtd}
            onChange={(e) => setNovaEtapaQtd(e.target.value)}
          />
          <input
            type="number"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Valor Unitario (R$)"
            step="0.01"
            min="0"
            value={novaEtapaValorUnit}
            onChange={(e) => setNovaEtapaValorUnit(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-gray-500">
            {novaEtapaQtd && novaEtapaValorUnit && (
              <span>
                Valor total: <strong className="text-gray-700">{formatCurrency((parseFloat(novaEtapaQtd) || 0) * (parseFloat(novaEtapaValorUnit) || 0))}</strong>
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={adicionarEtapa}
            disabled={!novaEtapa.trim() || !novaEtapaUnidade || !novaEtapaQtd || !novaEtapaValorUnit}
          >
            Adicionar
          </Button>
        </div>

        {etapas.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            Nenhuma etapa adicionada.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {etapas.map((etapa, index) => (
              <div
                key={etapa.id}
                className="px-4 py-2.5"
              >
                {editandoEtapaId === etapa.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input
                        type="text"
                        className="md:col-span-2 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        placeholder="Nome da etapa"
                        value={editandoEtapaNome}
                        onChange={(e) => setEditandoEtapaNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditandoEtapaId(null);
                        }}
                        autoFocus
                      />
                      <select
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        value={editandoEtapaUnidade}
                        onChange={(e) => setEditandoEtapaUnidade(e.target.value)}
                      >
                        <option value="">Unidade</option>
                        {unidadeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        placeholder="Quantidade"
                        step="0.01"
                        min="0"
                        value={editandoEtapaQtd}
                        onChange={(e) => setEditandoEtapaQtd(e.target.value)}
                      />
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        placeholder="Valor Unitario"
                        step="0.01"
                        min="0"
                        value={editandoEtapaValorUnit}
                        onChange={(e) => setEditandoEtapaValorUnit(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Valor total: <strong>{formatCurrency((parseFloat(editandoEtapaQtd) || 0) * (parseFloat(editandoEtapaValorUnit) || 0))}</strong>
                      </span>
                      <div className="flex gap-2">
                        <Button type="button" className="text-xs px-2 py-1" onClick={salvarEdicaoEtapa}>
                          Salvar
                        </Button>
                        <Button type="button" variant="ghost" className="text-xs px-2 py-1" onClick={() => setEditandoEtapaId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xs text-gray-400 font-mono w-6">{index + 1}.</span>
                      <div className="flex-1">
                        <span className="text-sm text-gray-700 font-medium">{etapa.nome}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          <span>{etapa.quantidade} {etapa.unidade}</span>
                          <span>{formatCurrency(etapa.valorUnitario)}/{etapa.unidade}</span>
                          <span className="font-semibold text-gray-700">
                            Total: {formatCurrency(etapa.quantidade * etapa.valorUnitario)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" variant="ghost" className="text-xs px-2 py-1" onClick={() => iniciarEdicaoEtapa(etapa)}>
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" className="text-xs px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => removerEtapa(etapa.id)}>
                        Remover
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Depositos - apenas na edicao */}
      {initial && <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Tanques de Combustivel
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Nome do tanque (Ex: Tanque Diesel 01)"
            value={novoDepNome}
            onChange={(e) => setNovoDepNome(e.target.value)}
          />
          <input
            type="number"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
            placeholder="Capacidade (litros)"
            min="0"
            step="1"
            value={novoDepCapacidade}
            onChange={(e) => setNovoDepCapacidade(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              type="number"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
              placeholder="Nivel atual (litros)"
              min="0"
              step="1"
              value={novoDepNivel}
              onChange={(e) => setNovoDepNivel(e.target.value)}
            />
            <Button
              type="button"
              onClick={adicionarDeposito}
              disabled={!novoDepNome.trim() || !novoDepCapacidade}
            >
              Adicionar
            </Button>
          </div>
        </div>

        {depositos.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            Nenhum tanque adicionado.
          </p>
        ) : (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {depositos.map((dep) => {
              const porcentagem =
                dep.capacidadeLitros > 0
                  ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100
                  : 0;
              const corBarra =
                porcentagem > 50
                  ? 'bg-green-500'
                  : porcentagem > 20
                    ? 'bg-yellow-500'
                    : 'bg-red-500';

              return (
                <div key={dep.id} className="px-4 py-3">
                  {editandoDepId === dep.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        value={editandoDepNome}
                        onChange={(e) => setEditandoDepNome(e.target.value)}
                        autoFocus
                      />
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                        placeholder="Capacidade"
                        value={editandoDepCapacidade}
                        onChange={(e) => setEditandoDepCapacidade(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                          placeholder="Nivel atual"
                          value={editandoDepNivel}
                          onChange={(e) => setEditandoDepNivel(e.target.value)}
                        />
                        <Button type="button" className="text-xs px-2 py-1" onClick={salvarEdicaoDeposito}>
                          Salvar
                        </Button>
                        <Button type="button" variant="ghost" className="text-xs px-2 py-1" onClick={() => setEditandoDepId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">
                            {dep.nome}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-48">
                            <div
                              className={`h-2 rounded-full ${corBarra}`}
                              style={{ width: `${Math.min(porcentagem, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {dep.nivelAtualLitros.toFixed(0)} / {dep.capacidadeLitros.toFixed(0)} L
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 ml-3">
                        <Button type="button" variant="ghost" className="text-xs px-2 py-1" onClick={() => iniciarEdicaoDeposito(dep)}>
                          Editar
                        </Button>
                        <Button type="button" variant="ghost" className="text-xs px-2 py-1 text-red-600 hover:bg-red-50" onClick={() => removerDeposito(dep.id)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>}

      {/* Acoes */}
      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alteracoes' : 'Cadastrar Obra'}
        </Button>
      </div>

      <ImportEtapasModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportEtapas}
        etapasExistentes={etapas}
        obraId={obraId}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
