import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { CargoFuncionario, EnderecoFuncionario, Funcionario } from '../../types';
import { useFuncionarios } from '../../hooks/useFuncionarios';
import { useAuth } from '../../contexts/AuthContext';
import { formatCPF, formatTelefone, formatCEP } from '../../utils/formatters';
import {
  CARGOS,
  ACOES_PLATAFORMA_VISIVEIS,
  GRUPOS_ACOES_VISIVEIS,
  acoesPadraoDoCargo,
  resolverDependencias,
  validarDependencias,
  ACOES_PERIGOSAS_OPERACIONAL,
  CARGOS_OPERACIONAIS,
  ACOES_DESTRUTIVAS,
} from '../../utils/permissions';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ImportExcelModal, { parseStr, parseData, type ParsedRow } from '../ui/ImportExcelModal';

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

function validarCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(digits[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(digits[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(digits[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(digits[10]);
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const VALID_CARGOS = CARGOS.map((c) => c.valor);

const FUNC_TEMPLATE = [
  ['Nome', 'Email', 'Cargo', 'Senha', 'CPF', 'Telefone', 'Data Nascimento', 'Data Admissão', 'Observações'],
  ['Carlos Silva', 'carlos@empresa.com', 'Operador', 'Senha123', '123.456.789-00', '(11) 99999-0000', '1990-05-20', '2024-01-15', ''],
  ['Maria Santos', 'maria@empresa.com', 'Supervisor', 'Senha456', '', '', '', '', 'Turno noturno'],
];

interface FuncionarioFormProps {
  initial: Funcionario | null;
  onSubmit: (func: Funcionario, senha?: string) => void;
  onCancel: () => void;
  onImportBatch?: (items: Funcionario[], senhas: Map<string, string>) => void;
}

export default function FuncionarioForm({ initial, onSubmit, onCancel, onImportBatch }: FuncionarioFormProps) {
  const { data: funcionariosData } = useFuncionarios();
  const { usuario: usuarioLogado } = useAuth();
  const allFuncionarios = funcionariosData ?? [];

  const [nome, setNome] = useState(initial?.nome || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [cpf, setCpf] = useState(initial?.cpf || '');
  const [telefone, setTelefone] = useState(initial?.telefone || '');
  const [dataNascimento, setDataNascimento] = useState(initial?.dataNascimento || '');
  const [cargo, setCargo] = useState<CargoFuncionario>(initial?.cargo || 'Operador');
  const [dataAdmissao, setDataAdmissao] = useState(initial?.dataAdmissao || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [status, setStatus] = useState<'ativo' | 'inativo'>(initial?.status || 'ativo');

  // Endereco
  const [rua, setRua] = useState(initial?.endereco.rua || '');
  const [numero, setNumero] = useState(initial?.endereco.numero || '');
  const [complemento, setComplemento] = useState(initial?.endereco.complemento || '');
  const [bairro, setBairro] = useState(initial?.endereco.bairro || '');
  const [cidade, setCidade] = useState(initial?.endereco.cidade || '');
  const [estado, setEstado] = useState(initial?.endereco.estado || '');
  const [cep, setCep] = useState(initial?.endereco.cep || '');

  // Senha
  const [alterarSenha, setAlterarSenha] = useState(!initial);
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');

  // Ações Permitidas
  // - Novo usuário: começa com o template do cargo (least-privilege; admin marca extras)
  // - Edição: respeita o que está salvo (pode ser array vazio = usuário sem nenhum acesso)
  const [acoesPermitidas, setAcoesPermitidas] = useState<string[]>(
    initial?.acoesPermitidas ?? acoesPadraoDoCargo(cargo)
  );

  /**
   * Quando o cargo muda em CRIAÇÃO, reaplica o template do novo cargo
   * automaticamente. Em EDIÇÃO, não mexemos — o admin usa o botão
   * "Aplicar template do cargo" se quiser.
   */
  function trocarCargo(novoCargo: CargoFuncionario) {
    setCargo(novoCargo);
    if (!initial) {
      setAcoesPermitidas(acoesPadraoDoCargo(novoCargo));
    }
  }

  function aplicarTemplateDoCargo() {
    if (
      confirm(
        `Aplicar o template padrão do cargo "${cargo}"?\n\n` +
          'Isso substituirá as ações marcadas atualmente.'
      )
    ) {
      setAcoesPermitidas(acoesPadraoDoCargo(cargo));
    }
  }

  /**
   * Liga/desliga uma ação. Ao LIGAR, também liga automaticamente
   * suas dependências (ex: marcar "Excluir obras" marca "Visualizar obras"
   * e "Editar obras"). Ao DESLIGAR uma "Visualizar X", desliga em cascata
   * os filhos que dependem dela.
   */
  function toggleAcao(chave: string) {
    setAcoesPermitidas((prev) => {
      if (prev.includes(chave)) {
        // desmarcar: remove tudo que depende desta
        const dependentes = Object.entries({} as Record<string, string[]>)
          .filter(([, deps]) => deps.includes(chave))
          .map(([k]) => k);
        const cascade = new Set<string>([chave]);
        // detectar dependentes via varredura: para cada ação marcada,
        // se suas dependências incluem `chave`, ela também sai.
        for (const k of prev) {
          if (k === chave) continue;
          const deps = resolverDependencias(k);
          if (deps.includes(chave)) cascade.add(k);
        }
        void dependentes;
        return prev.filter((a) => !cascade.has(a));
      }
      // marcar: adiciona dependências
      const novas = new Set<string>(prev);
      novas.add(chave);
      for (const d of resolverDependencias(chave)) novas.add(d);
      return [...novas];
    });
  }

  function toggleGrupo(grupo: string) {
    const chavesDoGrupo = ACOES_PLATAFORMA_VISIVEIS
      .filter((a) => a.grupo === grupo)
      .map((a) => a.chave);
    const todasMarcadas = chavesDoGrupo.every((c) => acoesPermitidas.includes(c));
    if (todasMarcadas) {
      // Desmarca todo o grupo + dependentes externos
      setAcoesPermitidas((prev) => {
        const removidas = new Set(chavesDoGrupo);
        // remove também ações que dependem de qualquer ação do grupo
        for (const k of prev) {
          if (removidas.has(k)) continue;
          const deps = resolverDependencias(k);
          if (deps.some((d) => removidas.has(d))) removidas.add(k);
        }
        return prev.filter((a) => !removidas.has(a));
      });
    } else {
      // Marca todas do grupo + dependências
      setAcoesPermitidas((prev) => {
        const novas = new Set(prev);
        for (const c of chavesDoGrupo) {
          novas.add(c);
          for (const d of resolverDependencias(c)) novas.add(d);
        }
        return [...novas];
      });
    }
  }

  // --- Avisos visuais ---
  const acoesPerigosasMarcadas = useMemo(() => {
    if (!CARGOS_OPERACIONAIS.has(cargo)) return [];
    return acoesPermitidas.filter((a) => ACOES_PERIGOSAS_OPERACIONAL.has(a));
  }, [acoesPermitidas, cargo]);

  const errosDependencia = useMemo(
    () => validarDependencias(acoesPermitidas),
    [acoesPermitidas]
  );

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [erros, setErros] = useState<string[]>([]);

  function validar(): string[] {
    const e: string[] = [];
    if (!nome.trim()) e.push('Nome e obrigatorio.');
    if (!email.trim()) e.push('E-mail e obrigatorio.');
    else {
      const existente = allFuncionarios.find(
        (f) => f.email.toLowerCase() === email.trim().toLowerCase()
      );
      if (existente && existente.id !== initial?.id) e.push('E-mail ja cadastrado.');
    }
    if (cpf && !validarCPF(cpf)) e.push('CPF invalido.');
    if (dataNascimento) {
      const nasc = new Date(dataNascimento);
      const idade = (Date.now() - nasc.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (idade < 18) e.push('Funcionario deve ter pelo menos 18 anos.');
    }
    if (!initial || alterarSenha) {
      if (!senha) e.push('A senha e obrigatoria.');
      else if (senha.length < 6) e.push('A senha deve ter pelo menos 6 caracteres.');
      if (senha !== confirmarSenha) e.push('As senhas nao conferem.');
    }

    // Dependências entre ações
    e.push(...errosDependencia);

    // Auto-edição: o admin não pode remover a própria capacidade de gerenciar permissões
    if (initial && usuarioLogado && initial.id === usuarioLogado.funcionarioId) {
      if (usuarioLogado.cargo === 'Administrador' && cargo !== 'Administrador') {
        e.push('Você não pode alterar o seu próprio cargo de Administrador.');
      }
      if (
        usuarioLogado.acoesPermitidas?.includes('gerenciar_permissoes') &&
        !acoesPermitidas.includes('gerenciar_permissoes')
      ) {
        e.push('Você não pode remover sua própria permissão de "Gerenciar permissões".');
      }
    }

    // Apenas Administrador pode atribuir o cargo Administrador
    if (cargo === 'Administrador' && usuarioLogado?.cargo !== 'Administrador') {
      e.push('Apenas um Administrador pode atribuir o cargo de Administrador.');
    }

    return e;
  }

  function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const errosVal = validar();
    if (errosVal.length > 0) { setErros(errosVal); return; }

    const now = new Date().toISOString();
    const endereco: EnderecoFuncionario = { rua, numero, complemento, bairro, cidade, estado, cep };

    const func: Funcionario = {
      id: initial?.id || gerarId(),
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      cpf,
      telefone,
      dataNascimento,
      endereco,
      senha: initial?.senha || '',
      status,
      cargo,
      dataAdmissao,
      observacoes,
      dataCriacao: initial?.dataCriacao || now,
      dataAtualizacao: now,
      acoesPermitidas,
    };

    // Pass raw password to parent when creating or changing password
    const rawSenha = (!initial || alterarSenha) ? senha : undefined;
    onSubmit(func, rawSenha);
  }

  const parseRowFunc = useCallback(
    (row: unknown[]): ParsedRow => {
      const errosRow: string[] = [];
      const nomeR = parseStr(row[0]);
      const emailR = parseStr(row[1]);
      const cargoR = parseStr(row[2]);
      const senhaR = parseStr(row[3]);
      const cpfR = parseStr(row[4]);
      const telefoneR = parseStr(row[5]);
      const dataNascR = parseData(row[6]);
      const dataAdmR = parseData(row[7]);
      const obsR = parseStr(row[8]);

      if (!nomeR) errosRow.push('Nome vazio');
      if (!emailR) errosRow.push('Email vazio');
      if (!cargoR) {
        errosRow.push('Cargo vazio');
      } else if (!VALID_CARGOS.includes(cargoR as CargoFuncionario)) {
        errosRow.push(`Cargo invalido: ${cargoR}`);
      }
      if (!senhaR) {
        errosRow.push('Senha vazia');
      } else if (senhaR.length < 6) {
        errosRow.push('Senha deve ter pelo menos 6 caracteres');
      }

      return {
        valido: errosRow.length === 0,
        erros: errosRow,
        resumo: `${nomeR || '(sem nome)'} | ${emailR || '(sem email)'} | ${cargoR || '(sem cargo)'}`,
        dados: { nome: nomeR, email: emailR, cargo: cargoR, senha: senhaR, cpf: cpfR, telefone: telefoneR, dataNascimento: dataNascR, dataAdmissao: dataAdmR, observacoes: obsR },
      };
    },
    []
  );

  const toEntityFunc = useCallback((row: ParsedRow): Record<string, unknown> => {
    const d = row.dados;
    const now = new Date().toISOString();
    return {
      id: gerarId(),
      nome: (d.nome as string).trim(),
      email: (d.email as string).trim().toLowerCase(),
      cpf: d.cpf || '',
      telefone: d.telefone || '',
      dataNascimento: d.dataNascimento || '',
      endereco: { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
      senha: '',
      status: 'ativo',
      cargo: d.cargo || 'Operador',
      dataAdmissao: d.dataAdmissao || '',
      observacoes: d.observacoes || '',
      dataCriacao: now,
      dataAtualizacao: now,
      acoesPermitidas: acoesPadraoDoCargo((d.cargo as CargoFuncionario) || 'Operador'),
      _senha: d.senha,
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}
      {/* Dados pessoais */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome Completo" id="funcNome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <Input label="E-mail" id="funcEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="CPF" id="funcCpf" value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" />
          <Input label="Telefone" id="funcTelefone" value={telefone} onChange={(e) => setTelefone(formatTelefone(e.target.value))} placeholder="(00) 00000-0000" />
          <Input label="Data Nascimento" id="funcNasc" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          <Select
            label="Cargo"
            id="funcCargo"
            value={cargo}
            onChange={(e) => trocarCargo(e.target.value as CargoFuncionario)}
            options={CARGOS.map((c) => ({ value: c.valor, label: c.label }))}
            required
          />
          <Input label="Data Admissão" id="funcAdmissao" type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} />
        </div>
      </div>

      {/* Endereco */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Rua" id="funcRua" value={rua} onChange={(e) => setRua(e.target.value)} />
          <Input label="Número" id="funcNumero" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Input label="Complemento" id="funcComplemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
          <Input label="Bairro" id="funcBairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input label="Cidade" id="funcCidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          <Select
            label="Estado"
            id="funcEstado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            options={UFS.map((uf) => ({ value: uf, label: uf }))}
            placeholder="Selecione"
          />
          <Input label="CEP" id="funcCep" value={cep} onChange={(e) => setCep(formatCEP(e.target.value))} placeholder="00000-000" />
        </div>
      </div>

      {/* Senha */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Senha</h3>
        {initial && (
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={alterarSenha} onChange={(e) => setAlterarSenha(e.target.checked)} className="rounded border-gray-300" />
              Alterar senha
            </label>
          </div>
        )}
        {alterarSenha && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Senha" id="funcSenha" type={initial ? 'password' : 'text'} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            <Input label="Confirmar Senha" id="funcConfirmarSenha" type={initial ? 'password' : 'text'} value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'ativo' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            onClick={() => setStatus('ativo')}
          >
            Ativo
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'inativo' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            onClick={() => setStatus('inativo')}
          >
            Inativo
          </button>
        </div>
      </div>

      {/* Acoes Permitidas */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Ações Permitidas</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {acoesPermitidas.length} de {ACOES_PLATAFORMA_VISIVEIS.length} ações marcadas
              {' · '}template padrão de <strong>{cargo}</strong>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              className="text-xs text-emt-verde hover:text-emt-verde-escuro font-medium"
              onClick={aplicarTemplateDoCargo}
              title="Substituir as marcações atuais pelo template padrão do cargo selecionado"
            >
              Aplicar template do cargo
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              className="text-xs text-red-600 hover:text-red-800 font-medium"
              onClick={() => setAcoesPermitidas([])}
            >
              Limpar Todos
            </button>
          </div>
        </div>

        {acoesPerigosasMarcadas.length > 0 && (
          <div className="mb-3 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-amber-800 mb-1">
              ⚠️ Permissões destrutivas para um cargo operacional ({cargo})
            </p>
            <p className="text-xs text-amber-700">
              Revise se este cargo realmente precisa de:&nbsp;
              {acoesPerigosasMarcadas
                .map((c) => ACOES_PLATAFORMA_VISIVEIS.find((a) => a.chave === c)?.label ?? c)
                .join(', ')}
              .
            </p>
          </div>
        )}

        <div className="space-y-4">
          {GRUPOS_ACOES_VISIVEIS.map((grupo) => {
            const acoesDoGrupo = ACOES_PLATAFORMA_VISIVEIS.filter((a) => a.grupo === grupo);
            const todasMarcadas = acoesDoGrupo.every((a) => acoesPermitidas.includes(a.chave));
            const algumaMarcada = acoesDoGrupo.some((a) => acoesPermitidas.includes(a.chave));
            return (
              <div key={grupo} className="bg-gray-50 rounded-lg p-3">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    ref={(el) => { if (el) el.indeterminate = algumaMarcada && !todasMarcadas; }}
                    onChange={() => toggleGrupo(grupo)}
                    className="w-4 h-4 text-emt-verde border-gray-300 rounded focus:ring-emt-verde"
                  />
                  <span className="text-sm font-semibold text-gray-700">{grupo}</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 ml-6">
                  {acoesDoGrupo.map((acao) => {
                    const destrutiva = ACOES_DESTRUTIVAS.has(acao.chave);
                    return (
                      <label key={acao.chave} className="flex items-center gap-2 cursor-pointer py-0.5">
                        <input
                          type="checkbox"
                          checked={acoesPermitidas.includes(acao.chave)}
                          onChange={() => toggleAcao(acao.chave)}
                          className="w-3.5 h-3.5 text-emt-verde border-gray-300 rounded focus:ring-emt-verde"
                        />
                        <span
                          className={`text-sm ${destrutiva ? 'text-red-700 font-medium' : 'text-gray-600'}`}
                          title={destrutiva ? 'Ação destrutiva — atribua com cuidado' : undefined}
                        >
                          {acao.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Observacoes */}
      <div>
        <label htmlFor="funcObs" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
        <textarea
          id="funcObs"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      {erros.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {erros.map((e, i) => <p key={i} className="text-sm text-red-600">{e}</p>)}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">{initial ? 'Salvar Alterações' : 'Cadastrar Usuário'}</Button>
      </div>

      {onImportBatch && (
        <ImportExcelModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImport={(items) => {
            const senhas = new Map<string, string>();
            const funcs = items.map((item) => {
              const f = item as Record<string, unknown>;
              if (f._senha) senhas.set(f.id as string, f._senha as string);
              const { _senha, ...rest } = f;
              void _senha;
              return rest as unknown as Funcionario;
            });
            onImportBatch(funcs, senhas);
            setImportModalOpen(false);
            setToastMsg(`${funcs.length} usuário${funcs.length !== 1 ? 's' : ''} importado${funcs.length !== 1 ? 's' : ''} com sucesso`);
            setTimeout(() => setToastMsg(''), 4000);
          }}
          title="Importar Usuários do Excel"
          entityLabel="Usuário"
          templateData={FUNC_TEMPLATE}
          templateFileName="template_funcionarios.xlsx"
          sheetName="Funcionarios"
          templateColWidths={[20, 25, 14, 12, 16, 16, 14, 14, 15]}
          formatHintHeaders={['Nome', 'Email', 'Cargo', 'Senha', 'CPF', 'Telefone', 'Dt Nasc', 'Dt Adm', 'Obs']}
          formatHintExample={['Carlos Silva', 'carlos@emp.com', 'Operador', 'Senha123', '', '', '', '', '']}
          parseRow={parseRowFunc}
          toEntity={toEntityFunc}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-[60] bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
