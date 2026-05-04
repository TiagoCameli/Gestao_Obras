import { useCallback, useMemo, useState, useEffect, useRef, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PagamentoFrete, MetodoPagamentoFrete, Funcionario, Fornecedor } from '../../types';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseNumero, parseData, type ParsedRow } from '../ui/ImportExcelModal';
import PagamentoAbatimentoCard from './PagamentoAbatimentoCard';
import { supabase } from '../../lib/supabase';

function PagoPorCombobox({ id, opcoes, value, onChange }: {
  id: string;
  opcoes: { nome: string; tipo: string }[];
  value: string;
  onChange: (nome: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const filtrados = opcoes.filter((o) =>
    o.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
        type="text"
        className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
        placeholder="Buscar por nome..."
        value={aberto ? busca : value}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }}
        onFocus={() => { setAberto(true); setBusca(''); }}
        autoComplete="off"
        required={!value}
      />
      {aberto && (
        <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg">
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</li>
          ) : (
            filtrados.map((o, i) => (
              <li
                key={`${o.nome}-${i}`}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-green-50 ${o.nome === value ? 'bg-green-100 font-medium' : ''}`}
                onMouseDown={() => { onChange(o.nome); setAberto(false); setBusca(''); }}
              >
                {o.nome} <span className="text-gray-400 text-xs">({o.tipo})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function gerarMeses(): { value: string; label: string }[] {
  const hoje = new Date();
  const meses: { value: string; label: string }[] = [];
  const nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  for (let offset = -24; offset <= 6; offset++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${nomesMes[d.getMonth()]} ${d.getFullYear()}`;
    meses.push({ value: valor, label });
  }
  return meses;
}

interface PagamentoFreteFormProps {
  initial?: PagamentoFrete | null;
  onSubmit: (data: PagamentoFrete) => void;
  onSubmitBatch?: (data: PagamentoFrete[]) => void;
  onCancel: () => void;
  transportadoras: string[];
  funcionarios: Funcionario[];
  fornecedores: Fornecedor[];
  nomeUsuario?: string;
  onImportBatch?: (items: PagamentoFrete[]) => void;
}

const METODOS: { value: MetodoPagamentoFrete; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'combustivel', label: 'Combustível' },
];

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const PAGFRETE_TEMPLATE = [
  ['Data', 'Transportadora', 'Mês Referência', 'Valor', 'Método', 'Responsavel', 'NF', 'Pago Por', 'Observações'],
  ['2024-01-15', 'Transportes ABC', '2024-01', '5000', 'pix', 'Carlos Silva', 'NF-001', 'Maria Santos', ''],
];

const METODOS_VALIDOS = ['pix', 'boleto', 'cheque', 'dinheiro', 'transferencia', 'combustivel'];

export default function PagamentoFreteForm({
  initial,
  onSubmit,
  onSubmitBatch,
  onCancel,
  transportadoras,
  funcionarios,
  fornecedores,
  nomeUsuario,
  onImportBatch,
}: PagamentoFreteFormProps) {
  const [data, setData] = useState(initial?.data || '');
  const [transportadora, setTransportadora] = useState(initial?.transportadora || '');
  const [mesReferencia, setMesReferencia] = useState(initial?.mesReferencia || '');
  const [valor, setValor] = useState(initial?.valor?.toString() || '');
  const [metodo, setMetodo] = useState<MetodoPagamentoFrete>(initial?.metodo || 'pix');
  const [quantidadeCombustivel, setQuantidadeCombustivel] = useState(
    initial?.quantidadeCombustivel?.toString() || ''
  );
  const [responsavel, setResponsavel] = useState(initial?.responsavel || nomeUsuario || '');
  const [notaFiscal, setNotaFiscal] = useState(initial?.notaFiscal || '');
  const [pagoPor, setPagoPor] = useState(initial?.pagoPor || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');

  // Dividir entre meses
  const [dividir, setDividir] = useState(false);
  const [parcelas, setParcelas] = useState<{ mesReferencia: string; valor: string }[]>([
    { mesReferencia: '', valor: '' },
    { mesReferencia: '', valor: '' },
  ]);

  // Abatimento de débitos de combustível (Fase 4 / Item 4 / D8).
  // Card só aparece se transportadora selecionada tem débitos pendentes.
  // Lookup do transportadora_id por nome (compat: form recebe text livre).
  const transportadoraId = useMemo(() => {
    if (!transportadora) return null;
    const f = fornecedores.find(
      (f) => f.ehTransportadora && f.nome.trim().toLowerCase() === transportadora.trim().toLowerCase()
    );
    return f?.id ?? null;
  }, [transportadora, fornecedores]);
  const [movimentosAbatidos, setMovimentosAbatidos] = useState<string[]>([]);
  const [valorAbatido, setValorAbatido] = useState(0);
  const handleAbatimentoChange = useCallback((valor: number, ids: string[]) => {
    setValorAbatido(valor);
    setMovimentosAbatidos(ids);
  }, []);

  const qc = useQueryClient();

  // Import Excel
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const parseRow = useCallback(
    (row: unknown[], _index: number): ParsedRow => {
      const erros: string[] = [];
      const data = parseData(row[0]);
      const transportadora = parseStr(row[1]);
      const mesReferencia = parseStr(row[2]);
      const valor = parseNumero(row[3]);
      const metodoRaw = parseStr(row[4]).toLowerCase() || 'pix';
      const responsavel = parseStr(row[5]);
      const notaFiscal = parseStr(row[6]);
      const pagoPor = parseStr(row[7]);
      const observacoes = parseStr(row[8]);

      if (!data) erros.push('Falta data');
      if (!transportadora) erros.push('Falta transportadora');
      if (!mesReferencia) erros.push('Falta mes referencia');
      if (valor === null) erros.push('Falta valor');
      if (!METODOS_VALIDOS.includes(metodoRaw)) erros.push(`Metodo "${metodoRaw}" invalido`);
      if (!responsavel) erros.push('Falta responsavel');

      const resumo = `${data || '?'} | ${transportadora || '?'} | ${mesReferencia || '?'} | R$ ${valor ?? '?'}`;

      return {
        valido: erros.length === 0,
        erros,
        resumo,
        dados: { data, transportadora, mesReferencia, valor: valor ?? 0, metodo: metodoRaw, responsavel, notaFiscal, pagoPor, observacoes },
      };
    },
    []
  );

  const toEntity = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    return {
      id: gerarId(),
      data: d.data,
      transportadora: d.transportadora,
      mesReferencia: d.mesReferencia,
      valor: d.valor,
      metodo: d.metodo,
      quantidadeCombustivel: 0,
      responsavel: d.responsavel,
      notaFiscal: d.notaFiscal,
      pagoPor: d.pagoPor,
      observacoes: d.observacoes,
      criadoPor: '',
    };
  }, []);

  const handleImportBatch = useCallback(
    (items: Record<string, unknown>[]) => {
      if (onImportBatch) {
        onImportBatch(items as unknown as PagamentoFrete[]);
        setToastMsg(`${items.length} pagamento${items.length !== 1 ? 's' : ''} importado${items.length !== 1 ? 's' : ''} com sucesso`);
        setTimeout(() => setToastMsg(''), 4000);
      }
    },
    [onImportBatch]
  );

  useEffect(() => {
    if (initial) {
      setData(initial.data);
      setTransportadora(initial.transportadora);
      setMesReferencia(initial.mesReferencia);
      setValor(initial.valor?.toString() || '');
      setMetodo(initial.metodo);
      setQuantidadeCombustivel(initial.quantidadeCombustivel?.toString() || '');
      setResponsavel(initial.responsavel);
      setNotaFiscal(initial.notaFiscal);
      setPagoPor(initial.pagoPor || '');
      setObservacoes(initial.observacoes);
    }
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (dividir && !initial && onSubmitBatch) {
      const items: PagamentoFrete[] = parcelas.map((p) => ({
        id: gerarId(),
        data,
        transportadora,
        mesReferencia: p.mesReferencia,
        valor: parseFloat(p.valor) || 0,
        metodo,
        quantidadeCombustivel: metodo === 'combustivel' ? (parseFloat(quantidadeCombustivel) || 0) : 0,
        responsavel,
        notaFiscal,
        pagoPor,
        observacoes,
        criadoPor: '',
      }));
      onSubmitBatch(items);
      // Abatimento NÃO aplicado a parcelas — múltiplos pagamentos não têm
      // mapeamento natural pra débitos. Anotar pra usuário se virar dor.
    } else {
      const pagamentoId = initial?.id || gerarId();
      onSubmit({
        id: pagamentoId,
        data,
        transportadora,
        mesReferencia,
        valor: parseFloat(valor) || 0,
        metodo,
        quantidadeCombustivel: metodo === 'combustivel' ? (parseFloat(quantidadeCombustivel) || 0) : 0,
        responsavel,
        notaFiscal,
        pagoPor,
        observacoes,
        criadoPor: initial?.criadoPor || '',
      });

      // Marca os débitos de combustível como abatidos por este pagamento.
      // Após o UPDATE, invalida queryKeys pra UI refletir imediato:
      //  - ['transportadora_movimentos'] pra extrato e card de abatimento
      //  - ['transportadora_saldos'] pra cards da Conta Corrente
      // Edição não suporta abatimento — não roda esse bloco.
      if (!initial && movimentosAbatidos.length > 0) {
        try {
          const { error } = await supabase
            .from('transportadora_movimentos')
            .update({ abatido_em_pagamento_id: pagamentoId })
            .in('id', movimentosAbatidos);
          if (error) {
            console.error('Erro ao marcar débitos abatidos:', error);
          } else {
            qc.invalidateQueries({ queryKey: ['transportadora_movimentos'] });
            qc.invalidateQueries({ queryKey: ['transportadora_saldos'] });
            qc.invalidateQueries({ queryKey: ['saldo_devedor_combustivel'] });
          }
        } catch (e) {
          console.error('Falha no UPDATE abatido_em_pagamento_id:', e);
        }
      }
    }
  }

  const funcionariosAtivos = funcionarios.filter((f) => f.status === 'ativo');

  const mesesOptions = useMemo(() => gerarMeses(), []);

  const pagoPorOpcoes = useMemo(() => {
    const lista: { nome: string; tipo: string }[] = [
      { nome: 'EMT Construtora', tipo: 'Empresa' },
    ];
    for (const f of fornecedores.filter((f) => f.ativo)) {
      lista.push({ nome: f.nome, tipo: 'Fornecedor' });
    }
    for (const f of funcionariosAtivos) {
      lista.push({ nome: f.nome, tipo: 'Funcionário' });
    }
    return lista;
  }, [fornecedores, funcionariosAtivos]);

  const parcelasValidas = dividir && !initial
    ? parcelas.length >= 2 && parcelas.every((p) => p.mesReferencia && p.valor && parseFloat(p.valor) > 0)
    : true;
  // Bloqueia submit quando abatimento excede valor bruto (pagamento líquido
  // negativo não faz sentido). Aviso visual fica no PagamentoAbatimentoCard.
  const valorBrutoNum = parseFloat(valor) || 0;
  const abatimentoValido = valorAbatido <= valorBrutoNum;
  const isValid = dividir && !initial
    ? data && transportadora && responsavel && pagoPor && parcelasValidas
    : data && transportadora && mesReferencia && valor && responsavel && pagoPor && abatimentoValido;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Data do Pagamento"
          id="pagFreteData"
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <Select
          label="Transportadora"
          id="pagFreteTransportadora"
          value={transportadora}
          onChange={(e) => setTransportadora(e.target.value)}
          options={transportadoras.map((t) => ({ value: t, label: t }))}
          placeholder="Selecione a transportadora"
          required
        />
        {!(dividir && !initial) && (
          <>
            <Select
              label="Mês Referência"
              id="pagFreteMesRef"
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              options={mesesOptions}
              placeholder="Selecione o mês"
              required
            />
            <Input
              label="Valor (R$)"
              id="pagFreteValor"
              type="number"
              step="0.0001"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </>
        )}
        <Select
          label="Método de Pagamento"
          id="pagFreteMetodo"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value as MetodoPagamentoFrete)}
          options={METODOS}
          required
        />
        {metodo === 'combustivel' && (
          <Input
            label="Quantidade Combustível (litros)"
            id="pagFreteQtdCombustivel"
            type="number"
            step="0.0001"
            min="0"
            value={quantidadeCombustivel}
            onChange={(e) => setQuantidadeCombustivel(e.target.value)}
            required
          />
        )}
        <Input
          label="Responsável"
          id="pagFreteResponsavel"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          required
          readOnly
        />
        <Input
          label="Nota Fiscal (opcional)"
          id="pagFreteNF"
          type="text"
          value={notaFiscal}
          onChange={(e) => setNotaFiscal(e.target.value)}
          placeholder="Ex: NF-e 12345"
        />
        <div>
          <label htmlFor="pagFretePagoPor" className="block text-sm font-medium text-gray-700 mb-1">Pago Por</label>
          <PagoPorCombobox
            id="pagFretePagoPor"
            opcoes={pagoPorOpcoes}
            value={pagoPor}
            onChange={setPagoPor}
          />
        </div>
      </div>

      {/* Card de abatimento de débitos de combustível (Fase 4 / D8).
          Só aparece quando: transportadora resolvida pra ID + saldo devedor > 0
          + não está em modo dividir + não está editando. */}
      {!initial && !dividir && transportadoraId && (
        <PagamentoAbatimentoCard
          transportadoraId={transportadoraId}
          valorBrutoPagamento={parseFloat(valor) || 0}
          onChange={handleAbatimentoChange}
        />
      )}

      {/* Toggle dividir entre meses — só para novo pagamento */}
      {!initial && onSubmitBatch && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={dividir}
              onChange={(e) => setDividir(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <span className="text-sm font-medium text-gray-700">Dividir entre meses</span>
          </label>

          {dividir && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
              <p className="text-xs text-gray-500">Adicione o mês e valor de cada parcela:</p>
              {parcelas.map((parcela, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Mês Referência</label>
                    )}
                    <select
                      className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                      value={parcela.mesReferencia}
                      onChange={(e) => {
                        const novas = [...parcelas];
                        novas[idx] = { ...novas[idx], mesReferencia: e.target.value };
                        setParcelas(novas);
                      }}
                      required
                    >
                      <option value="">Selecione o mês</option>
                      {mesesOptions.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36">
                    {idx === 0 && (
                      <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
                    )}
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="w-full h-[38px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white"
                      placeholder="0,00"
                      value={parcela.valor}
                      onChange={(e) => {
                        const novas = [...parcelas];
                        novas[idx] = { ...novas[idx], valor: e.target.value };
                        setParcelas(novas);
                      }}
                      required
                    />
                  </div>
                  {parcelas.length > 2 && (
                    <button
                      type="button"
                      className="h-[38px] px-2 text-red-500 hover:text-red-700 text-lg font-bold"
                      title="Remover parcela"
                      onClick={() => setParcelas(parcelas.filter((_, i) => i !== idx))}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                  onClick={() => setParcelas([...parcelas, { mesReferencia: '', valor: '' }])}
                >
                  + Adicionar mês
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  Total: {parcelas.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label htmlFor="pagFreteObs" className="block text-sm font-medium text-gray-700 mb-1">
          Observações (opcional)
        </label>
        <textarea
          id="pagFreteObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={3}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Alguma observação..."
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!isValid}>
          {initial ? 'Salvar Alterações' : 'Registrar Pagamento'}
        </Button>
      </div>

      <ImportExcelModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportBatch}
        title="Importar Pagamentos de Frete do Excel"
        entityLabel="Pagamento"
        genderFem={false}
        templateData={PAGFRETE_TEMPLATE}
        templateFileName="template_pagamentos_frete.xlsx"
        sheetName="Pagamentos"
        templateColWidths={[12, 20, 14, 12, 14, 20, 10, 18, 15]}
        formatHintHeaders={['Data', 'Transportadora', 'Mês Ref', 'Valor', 'Método', 'Responsavel', 'NF', 'Pago Por', 'Obs']}
        formatHintExample={['2024-01-15', 'ABC', '2024-01', '5000', 'pix', 'Carlos', '', 'Maria', '']}
        parseRow={parseRow}
        toEntity={toEntity}
      />

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium animate-[fadeIn_0.2s_ease-out]">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
