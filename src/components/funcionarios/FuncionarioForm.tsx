/**
 * FuncionarioForm — Onda 5.B: migrado pra react-hook-form + Zod (hybrid).
 *
 * Hybrid: RHF cuida dos campos simples (dados pessoais + endereço + senhas
 * + status + observações). `acoesPermitidas` (matriz dinâmica de checkboxes
 * com cascade de dependências, toggle por grupo, salvaguardas de
 * auto-edição) continua em useState — RHF não cobre bem esse caso e a
 * lógica é estável.
 *
 * Validações cross-field manuais no submit handler (não no schema):
 *  - E-mail já cadastrado
 *  - Auto-protection do próprio Admin (remover permissões críticas, etc)
 *  - Cargo Administrador só pode ser atribuído por Admin
 *
 * Schema cobre o resto (CPF, email format, idade >= 18, senhas conferem).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  funcionarioFormSchema,
  type FuncionarioFormValues,
} from '../../schemas/funcionarios/funcionario.schema';

const UFS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

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
  onSubmit: (func: Funcionario, senha?: string) => void | Promise<void>;
  onCancel: () => void;
  onImportBatch?: (items: Funcionario[], senhas: Map<string, string>) => void;
}

function buildDefaults(initial: Funcionario | null): FuncionarioFormValues {
  return {
    nome: initial?.nome || '',
    email: initial?.email || '',
    cpf: initial?.cpf || '',
    telefone: initial?.telefone || '',
    dataNascimento: initial?.dataNascimento || '',
    cargo: (initial?.cargo as string) || 'Operador',
    dataAdmissao: initial?.dataAdmissao || '',
    status: initial?.status || 'ativo',
    observacoes: initial?.observacoes || '',
    enderecoRua: initial?.endereco?.rua || '',
    enderecoNumero: initial?.endereco?.numero || '',
    enderecoComplemento: initial?.endereco?.complemento || '',
    enderecoBairro: initial?.endereco?.bairro || '',
    enderecoCidade: initial?.endereco?.cidade || '',
    enderecoEstado: initial?.endereco?.estado || '',
    enderecoCep: initial?.endereco?.cep || '',
    senha: '',
    confirmarSenha: '',
  };
}

export default function FuncionarioForm({ initial, onSubmit, onCancel, onImportBatch }: FuncionarioFormProps) {
  const { data: funcionariosData } = useFuncionarios();
  const { usuario: usuarioLogado } = useAuth();
  const allFuncionarios = funcionariosData ?? [];

  // ── Estado fora do RHF ──────────────────────────────────────────────────
  const [alterarSenha, setAlterarSenha] = useState(!initial);
  const [acoesPermitidas, setAcoesPermitidas] = useState<string[]>(
    initial?.acoesPermitidas ?? acoesPadraoDoCargo((initial?.cargo || 'Operador') as CargoFuncionario)
  );
  const [errosCustom, setErrosCustom] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // ── RHF + Zod ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FuncionarioFormValues>({
    resolver: zodResolver(funcionarioFormSchema),
    mode: 'onChange',
    defaultValues: buildDefaults(initial),
  });

  useEffect(() => {
    reset(buildDefaults(initial));
    setAcoesPermitidas(
      initial?.acoesPermitidas ?? acoesPadraoDoCargo((initial?.cargo || 'Operador') as CargoFuncionario)
    );
    setAlterarSenha(!initial);
  }, [initial, reset]);

  const cargoWatch = watch('cargo') as CargoFuncionario;
  const statusWatch = watch('status');

  /**
   * Quando o cargo muda em CRIAÇÃO, reaplica o template do novo cargo.
   * Em EDIÇÃO, não mexemos — admin usa botão "Aplicar template" se quiser.
   */
  function trocarCargo(novoCargo: CargoFuncionario) {
    setValue('cargo', novoCargo, { shouldValidate: true });
    if (!initial) {
      setAcoesPermitidas(acoesPadraoDoCargo(novoCargo));
    }
  }

  function aplicarTemplateDoCargo() {
    if (
      confirm(
        `Aplicar o template padrão do cargo "${cargoWatch}"?\n\n` +
          'Isso substituirá as ações marcadas atualmente.'
      )
    ) {
      setAcoesPermitidas(acoesPadraoDoCargo(cargoWatch));
    }
  }

  /**
   * Liga/desliga uma ação. Ao LIGAR, também liga automaticamente
   * suas dependências. Ao DESLIGAR, cascade pra filhos que dependem dela.
   */
  function toggleAcao(chave: string) {
    setAcoesPermitidas((prev) => {
      if (prev.includes(chave)) {
        const cascade = new Set<string>([chave]);
        for (const k of prev) {
          if (k === chave) continue;
          const deps = resolverDependencias(k);
          if (deps.includes(chave)) cascade.add(k);
        }
        return prev.filter((a) => !cascade.has(a));
      }
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
      setAcoesPermitidas((prev) => {
        const removidas = new Set(chavesDoGrupo);
        for (const k of prev) {
          if (removidas.has(k)) continue;
          const deps = resolverDependencias(k);
          if (deps.some((d) => removidas.has(d))) removidas.add(k);
        }
        return prev.filter((a) => !removidas.has(a));
      });
    } else {
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

  const acoesPerigosasMarcadas = useMemo(() => {
    if (!CARGOS_OPERACIONAIS.has(cargoWatch)) return [];
    return acoesPermitidas.filter((a) => ACOES_PERIGOSAS_OPERACIONAL.has(a));
  }, [acoesPermitidas, cargoWatch]);

  const errosDependencia = useMemo(
    () => validarDependencias(acoesPermitidas),
    [acoesPermitidas]
  );

  /** Validações cross-field manuais (que o schema não consegue cobrir). */
  function validarCrossField(values: FuncionarioFormValues): string[] {
    const e: string[] = [];

    // E-mail já cadastrado
    const existente = allFuncionarios.find(
      (f) => f.email.toLowerCase() === values.email.trim().toLowerCase()
    );
    if (existente && existente.id !== initial?.id) e.push('E-mail já cadastrado.');

    // Senha obrigatória no modo create OU quando alterarSenha
    if (!initial || alterarSenha) {
      if (!values.senha) e.push('A senha é obrigatória.');
    }

    // Dependências entre ações
    e.push(...errosDependencia);

    // Auto-edição: o admin não pode tirar a própria base de controle.
    if (initial && usuarioLogado && initial.id === usuarioLogado.funcionarioId) {
      if (usuarioLogado.cargo === 'Administrador' && values.cargo !== 'Administrador') {
        e.push('Você não pode alterar o seu próprio cargo de Administrador.');
      }
      const ACOES_AUTOPROTECAO = [
        { chave: 'ver_funcionarios', label: 'Visualizar usuários' },
        { chave: 'editar_funcionarios', label: 'Editar usuários' },
        { chave: 'gerenciar_permissoes', label: 'Gerenciar permissões de outros usuários' },
      ];
      for (const a of ACOES_AUTOPROTECAO) {
        if (!acoesPermitidas.includes(a.chave)) {
          e.push(
            `Você não pode remover a própria permissão "${a.label}" — sem ela perde o controle sobre os usuários.`
          );
        }
      }
      if (usuarioLogado.cargo === 'Administrador' && acoesPermitidas.length < 10) {
        e.push(
          'Você está prestes a salvar com pouquíssimas permissões. Clique em "Aplicar template do cargo" ou marque as ações que precisa.'
        );
      }
    }

    if (values.cargo === 'Administrador' && usuarioLogado?.cargo !== 'Administrador') {
      e.push('Apenas um Administrador pode atribuir o cargo de Administrador.');
    }

    return e;
  }

  const onValidSubmit = useCallback(async (values: FuncionarioFormValues) => {
    const errosVal = validarCrossField(values);
    if (errosVal.length > 0) {
      setErrosCustom(errosVal);
      return;
    }
    setErrosCustom([]);

    const now = new Date().toISOString();
    const endereco: EnderecoFuncionario = {
      rua: values.enderecoRua || '',
      numero: values.enderecoNumero || '',
      complemento: values.enderecoComplemento || '',
      bairro: values.enderecoBairro || '',
      cidade: values.enderecoCidade || '',
      estado: values.enderecoEstado || '',
      cep: values.enderecoCep || '',
    };

    const func: Funcionario = {
      id: initial?.id || gerarId(),
      nome: values.nome.trim(),
      email: values.email.trim().toLowerCase(),
      cpf: values.cpf || '',
      telefone: values.telefone || '',
      dataNascimento: values.dataNascimento || '',
      endereco,
      senha: initial?.senha || '',
      status: values.status,
      cargo: values.cargo as CargoFuncionario,
      dataAdmissao: values.dataAdmissao || '',
      observacoes: values.observacoes || '',
      dataCriacao: initial?.dataCriacao || now,
      dataAtualizacao: now,
      acoesPermitidas,
    };

    const rawSenha = (!initial || alterarSenha) ? values.senha : undefined;
    try {
      await onSubmit(func, rawSenha || undefined);
    } catch (e) {
      // Falha no salvar (ex.: RLS rejeitou, rede). Mostra na caixa de erro
      // em vez de sumir sem feedback.
      setErrosCustom([e instanceof Error ? e.message : 'Erro ao salvar. Tente novamente.']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, alterarSenha, acoesPermitidas, errosDependencia, allFuncionarios, usuarioLogado, onSubmit]);

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
    [],
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
    <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-6">
      {!initial && onImportBatch && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" onClick={() => setImportModalOpen(true)}>
            Importar do Excel
          </Button>
        </div>
      )}

      {/* Dados pessoais */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome Completo"
            id="funcNome"
            required
            error={errors.nome?.message}
            {...register('nome')}
          />
          <Input
            label="E-mail"
            id="funcEmail"
            type="email"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <Input
                label="CPF"
                id="funcCpf"
                placeholder="000.000.000-00"
                error={errors.cpf?.message}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatCPF(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <Input
                label="Telefone"
                id="funcTelefone"
                placeholder="(00) 00000-0000"
                error={errors.telefone?.message}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatTelefone(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Input
            label="Data Nascimento"
            id="funcNasc"
            type="date"
            error={errors.dataNascimento?.message}
            {...register('dataNascimento')}
          />
          <Controller
            control={control}
            name="cargo"
            render={({ field }) => (
              <Select
                label="Cargo"
                id="funcCargo"
                value={field.value}
                onChange={(e) => trocarCargo(e.target.value as CargoFuncionario)}
                options={CARGOS.map((c) => ({ value: c.valor, label: c.label }))}
                required
                error={errors.cargo?.message}
              />
            )}
          />
          <Input
            label="Data Admissão"
            id="funcAdmissao"
            type="date"
            error={errors.dataAdmissao?.message}
            {...register('dataAdmissao')}
          />
        </div>
      </div>

      {/* Endereço */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Rua" id="funcRua" {...register('enderecoRua')} />
          <Input label="Número" id="funcNumero" {...register('enderecoNumero')} />
          <Input label="Complemento" id="funcComplemento" {...register('enderecoComplemento')} />
          <Input label="Bairro" id="funcBairro" {...register('enderecoBairro')} />
          <Input label="Cidade" id="funcCidade" {...register('enderecoCidade')} />
          <Select
            label="Estado"
            id="funcEstado"
            options={UFS.map((uf) => ({ value: uf, label: uf }))}
            placeholder="Selecione"
            {...register('enderecoEstado')}
          />
          <Controller
            control={control}
            name="enderecoCep"
            render={({ field }) => (
              <Input
                label="CEP"
                id="funcCep"
                placeholder="00000-000"
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatCEP(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </div>
      </div>

      {/* Senha */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-3">Senha</h3>
        {initial && (
          <div className="mb-3">
            <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
              <input type="checkbox" checked={alterarSenha} onChange={(e) => setAlterarSenha(e.target.checked)} className="rounded border-[var(--color-border-strong)]" />
              Alterar senha
            </label>
          </div>
        )}
        {alterarSenha && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Senha"
              id="funcSenha"
              type={initial ? 'password' : 'text'}
              placeholder="Mínimo 6 caracteres"
              error={errors.senha?.message}
              {...register('senha')}
            />
            <Input
              label="Confirmar Senha"
              id="funcConfirmarSenha"
              type={initial ? 'password' : 'text'}
              error={errors.confirmarSenha?.message}
              {...register('confirmarSenha')}
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-fg)] mb-2">Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusWatch === 'ativo'
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)]'
            }`}
            onClick={() => setValue('status', 'ativo')}
          >
            Ativo
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusWatch === 'inativo'
                ? 'bg-[var(--color-danger)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-3)]'
            }`}
            onClick={() => setValue('status', 'inativo')}
          >
            Inativo
          </button>
        </div>
      </div>

      {/* Ações Permitidas */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">Ações Permitidas</h3>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {acoesPermitidas.length} de {ACOES_PLATAFORMA_VISIVEIS.length} ações marcadas
              {' · '}template padrão de <strong>{cargoWatch}</strong>
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] font-medium"
              onClick={aplicarTemplateDoCargo}
              title="Substituir as marcações atuais pelo template padrão do cargo selecionado"
            >
              Aplicar template do cargo
            </button>
            <span className="text-[var(--color-fg-subtle)]">|</span>
            <button
              type="button"
              className="text-xs text-[var(--color-danger)] hover:opacity-80 font-medium"
              onClick={() => setAcoesPermitidas([])}
            >
              Limpar Todos
            </button>
          </div>
        </div>

        {acoesPerigosasMarcadas.length > 0 && (
          <div className="mb-3 bg-[var(--color-warning-soft)] border border-[var(--color-warning)]/40 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-[var(--color-warning-fg)] mb-1">
              ⚠️ Permissões destrutivas para um cargo operacional ({cargoWatch})
            </p>
            <p className="text-xs text-[var(--color-warning-fg)]/85">
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
              <div key={grupo} className="bg-[var(--color-surface-2)]/40 rounded-lg p-3">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={todasMarcadas}
                    ref={(el) => { if (el) el.indeterminate = algumaMarcada && !todasMarcadas; }}
                    onChange={() => toggleGrupo(grupo)}
                    className="w-4 h-4 text-[var(--color-accent)] border-[var(--color-border-strong)] rounded focus:ring-[var(--color-ring)]"
                  />
                  <span className="text-sm font-semibold text-[var(--color-fg)]">{grupo}</span>
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
                          className="w-3.5 h-3.5 text-[var(--color-accent)] border-[var(--color-border-strong)] rounded focus:ring-[var(--color-ring)]"
                        />
                        <span
                          className={`text-sm ${destrutiva ? 'text-[var(--color-danger-fg)] font-medium' : 'text-[var(--color-fg-muted)]'}`}
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

      {/* Observações */}
      <div>
        <label htmlFor="funcObs" className="block text-sm font-medium text-[var(--color-fg)] mb-1">Observações</label>
        <textarea
          id="funcObs"
          className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          rows={2}
          {...register('observacoes')}
        />
      </div>

      {errosCustom.length > 0 && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger)]/30 rounded-lg px-4 py-3">
          {errosCustom.map((e, i) => <p key={i} className="text-sm text-[var(--color-danger-fg)]">{e}</p>)}
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
        <div className="fixed bottom-6 right-6 z-[var(--z-toast)] bg-[var(--color-success)] text-white px-5 py-3 rounded-lg shadow-[var(--shadow-lg)] text-sm font-medium">
          {toastMsg}
        </div>
      )}
    </form>
  );
}
