import type {
  Obra,
  EtapaObra,
  Deposito,
  Abastecimento,
  EntradaCombustivel,
  Equipamento,
  Insumo,
  TransferenciaCombustivel,
  Fornecedor,
  DepositoMaterial,
  UnidadeMedida,
  EntradaMaterial,
  SaidaMaterial,
  TransferenciaMaterial,
  Localidade,
  Frete,
  Funcionario,
  PerfilPermissao,
  AuditLogEntry,
  AlocacaoEtapa,
} from '../types';

// ── Obras ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToObra(row: any): Obra {
  return {
    id: row.id,
    nome: row.nome,
    endereco: row.endereco,
    status: row.status,
    dataInicio: row.data_inicio,
    dataPrevisaoFim: row.data_previsao_fim,
    responsavel: row.responsavel,
    orcamento: Number(row.orcamento),
  };
}

export function obraToDb(o: Obra) {
  return {
    id: o.id,
    nome: o.nome,
    endereco: o.endereco,
    status: o.status,
    data_inicio: o.dataInicio,
    data_previsao_fim: o.dataPrevisaoFim,
    responsavel: o.responsavel,
    orcamento: o.orcamento,
  };
}

// ── Etapas ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEtapa(row: any): EtapaObra {
  return {
    id: row.id,
    nome: row.nome,
    obraId: row.obra_id,
    unidade: row.unidade,
    quantidade: Number(row.quantidade),
    valorUnitario: Number(row.valor_unitario),
  };
}

export function etapaToDb(e: EtapaObra) {
  return {
    id: e.id,
    nome: e.nome,
    obra_id: e.obraId,
    unidade: e.unidade,
    quantidade: e.quantidade,
    valor_unitario: e.valorUnitario,
  };
}

// ── Depositos (combustivel) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToDeposito(row: any): Deposito {
  return {
    id: row.id,
    nome: row.nome,
    obraId: row.obra_id,
    capacidadeLitros: Number(row.capacidade_litros),
    nivelAtualLitros: Number(row.nivel_atual_litros),
    ativo: row.ativo,
  };
}

export function depositoToDb(d: Deposito) {
  return {
    id: d.id,
    nome: d.nome,
    obra_id: d.obraId,
    capacidade_litros: d.capacidadeLitros,
    nivel_atual_litros: d.nivelAtualLitros,
    ativo: d.ativo,
  };
}

// ── Abastecimentos ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToAbastecimento(row: any): Abastecimento {
  return {
    id: row.id,
    dataHora: row.data_hora,
    tipoCombustivel: row.tipo_combustivel,
    quantidadeLitros: Number(row.quantidade_litros),
    valorTotal: Number(row.valor_total),
    obraId: row.obra_id,
    etapaId: row.etapa_id,
    alocacoes: row.alocacoes ?? [],
    depositoId: row.deposito_id,
    veiculo: row.veiculo,
    observacoes: row.observacoes,
  };
}

export function abastecimentoToDb(a: Abastecimento) {
  return {
    id: a.id,
    data_hora: a.dataHora,
    tipo_combustivel: a.tipoCombustivel,
    quantidade_litros: a.quantidadeLitros,
    valor_total: a.valorTotal,
    obra_id: a.obraId,
    etapa_id: a.etapaId,
    alocacoes: a.alocacoes ?? [],
    deposito_id: a.depositoId,
    veiculo: a.veiculo,
    observacoes: a.observacoes,
  };
}

// ── Entradas Combustivel ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEntradaCombustivel(row: any): EntradaCombustivel {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoId: row.deposito_id,
    tipoCombustivel: row.tipo_combustivel,
    obraId: row.obra_id,
    quantidadeLitros: Number(row.quantidade_litros),
    valorTotal: Number(row.valor_total),
    fornecedor: row.fornecedor,
    notaFiscal: row.nota_fiscal,
    observacoes: row.observacoes,
  };
}

export function entradaCombustivelToDb(e: EntradaCombustivel) {
  return {
    id: e.id,
    data_hora: e.dataHora,
    deposito_id: e.depositoId,
    tipo_combustivel: e.tipoCombustivel,
    obra_id: e.obraId,
    quantidade_litros: e.quantidadeLitros,
    valor_total: e.valorTotal,
    fornecedor: e.fornecedor,
    nota_fiscal: e.notaFiscal,
    observacoes: e.observacoes,
  };
}

// ── Equipamentos ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEquipamento(row: any): Equipamento {
  return {
    id: row.id,
    nome: row.nome,
    codigoPatrimonio: row.codigo_patrimonio,
    numeroSerie: row.numero_serie,
    ano: row.ano,
    marca: row.marca,
    tipoMedicao: row.tipo_medicao,
    medicaoInicial: Number(row.medicao_inicial),
    ativo: row.ativo,
    dataAquisicao: row.data_aquisicao,
    dataVenda: row.data_venda,
  };
}

export function equipamentoToDb(e: Equipamento) {
  return {
    id: e.id,
    nome: e.nome,
    codigo_patrimonio: e.codigoPatrimonio,
    numero_serie: e.numeroSerie,
    ano: e.ano,
    marca: e.marca,
    tipo_medicao: e.tipoMedicao,
    medicao_inicial: e.medicaoInicial,
    ativo: e.ativo,
    data_aquisicao: e.dataAquisicao,
    data_venda: e.dataVenda,
  };
}

// ── Insumos ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToInsumo(row: any): Insumo {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    unidade: row.unidade,
    descricao: row.descricao,
    ativo: row.ativo,
  };
}

export function insumoToDb(i: Insumo) {
  return {
    id: i.id,
    nome: i.nome,
    tipo: i.tipo,
    unidade: i.unidade,
    descricao: i.descricao,
    ativo: i.ativo,
  };
}

// ── Transferencias Combustivel ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTransferenciaCombustivel(row: any): TransferenciaCombustivel {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoOrigemId: row.deposito_origem_id,
    depositoDestinoId: row.deposito_destino_id,
    quantidadeLitros: Number(row.quantidade_litros),
    valorTotal: Number(row.valor_total),
    observacoes: row.observacoes,
  };
}

export function transferenciaCombustivelToDb(t: TransferenciaCombustivel) {
  return {
    id: t.id,
    data_hora: t.dataHora,
    deposito_origem_id: t.depositoOrigemId,
    deposito_destino_id: t.depositoDestinoId,
    quantidade_litros: t.quantidadeLitros,
    valor_total: t.valorTotal,
    observacoes: t.observacoes,
  };
}

// ── Fornecedores ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToFornecedor(row: any): Fornecedor {
  return {
    id: row.id,
    nome: row.nome,
    cnpj: row.cnpj,
    telefone: row.telefone,
    email: row.email,
    observacoes: row.observacoes,
    ativo: row.ativo,
  };
}

export function fornecedorToDb(f: Fornecedor) {
  return {
    id: f.id,
    nome: f.nome,
    cnpj: f.cnpj,
    telefone: f.telefone,
    email: f.email,
    observacoes: f.observacoes,
    ativo: f.ativo,
  };
}

// ── Depositos Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToDepositoMaterial(row: any): DepositoMaterial {
  return {
    id: row.id,
    nome: row.nome,
    obraId: row.obra_id,
    endereco: row.endereco,
    responsavel: row.responsavel,
    ativo: row.ativo,
  };
}

export function depositoMaterialToDb(d: DepositoMaterial) {
  return {
    id: d.id,
    nome: d.nome,
    obra_id: d.obraId,
    endereco: d.endereco,
    responsavel: d.responsavel,
    ativo: d.ativo,
  };
}

// ── Unidades de Medida ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToUnidadeMedida(row: any): UnidadeMedida {
  return {
    id: row.id,
    nome: row.nome,
    sigla: row.sigla,
    ativo: row.ativo,
  };
}

export function unidadeMedidaToDb(u: UnidadeMedida) {
  return {
    id: u.id,
    nome: u.nome,
    sigla: u.sigla,
    ativo: u.ativo,
  };
}

// ── Entradas Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEntradaMaterial(row: any): EntradaMaterial {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoMaterialId: row.deposito_material_id,
    insumoId: row.insumo_id,
    obraId: row.obra_id,
    quantidade: Number(row.quantidade),
    valorTotal: Number(row.valor_total),
    fornecedorId: row.fornecedor_id,
    notaFiscal: row.nota_fiscal,
    observacoes: row.observacoes,
  };
}

export function entradaMaterialToDb(e: EntradaMaterial) {
  return {
    id: e.id,
    data_hora: e.dataHora,
    deposito_material_id: e.depositoMaterialId,
    insumo_id: e.insumoId,
    obra_id: e.obraId,
    quantidade: e.quantidade,
    valor_total: e.valorTotal,
    fornecedor_id: e.fornecedorId,
    nota_fiscal: e.notaFiscal,
    observacoes: e.observacoes,
  };
}

// ── Saidas Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToSaidaMaterial(row: any): SaidaMaterial {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoMaterialId: row.deposito_material_id,
    insumoId: row.insumo_id,
    obraId: row.obra_id,
    quantidade: Number(row.quantidade),
    valorTotal: Number(row.valor_total),
    alocacoes: row.alocacoes ?? [],
    observacoes: row.observacoes,
  };
}

export function saidaMaterialToDb(s: SaidaMaterial) {
  return {
    id: s.id,
    data_hora: s.dataHora,
    deposito_material_id: s.depositoMaterialId,
    insumo_id: s.insumoId,
    obra_id: s.obraId,
    quantidade: s.quantidade,
    valor_total: s.valorTotal,
    alocacoes: s.alocacoes ?? [],
    observacoes: s.observacoes,
  };
}

// ── Transferencias Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTransferenciaMaterial(row: any): TransferenciaMaterial {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoOrigemId: row.deposito_origem_id,
    depositoDestinoId: row.deposito_destino_id,
    insumoId: row.insumo_id,
    quantidade: Number(row.quantidade),
    valorTotal: Number(row.valor_total),
    observacoes: row.observacoes,
  };
}

export function transferenciaMaterialToDb(t: TransferenciaMaterial) {
  return {
    id: t.id,
    data_hora: t.dataHora,
    deposito_origem_id: t.depositoOrigemId,
    deposito_destino_id: t.depositoDestinoId,
    insumo_id: t.insumoId,
    quantidade: t.quantidade,
    valor_total: t.valorTotal,
    observacoes: t.observacoes,
  };
}

// ── Localidades ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToLocalidade(row: any): Localidade {
  return {
    id: row.id,
    nome: row.nome,
    endereco: row.endereco ?? '',
    ativo: row.ativo,
  };
}

export function localidadeToDb(l: Localidade) {
  return {
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
    ativo: l.ativo,
  };
}

// ── Fretes ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToFrete(row: any): Frete {
  return {
    id: row.id,
    data: row.data,
    obraId: row.obra_id ?? '',
    origem: row.origem,
    destino: row.destino,
    transportadora: row.transportadora,
    insumoId: row.insumo_id,
    pesoToneladas: Number(row.peso_toneladas),
    kmRodados: Number(row.km_rodados),
    valorTkm: Number(row.valor_tkm),
    valorTotal: Number(row.valor_total),
    notaFiscal: row.nota_fiscal,
    observacoes: row.observacoes,
  };
}

export function freteToDb(f: Frete) {
  return {
    id: f.id,
    data: f.data,
    obra_id: f.obraId || null,
    origem: f.origem,
    destino: f.destino,
    transportadora: f.transportadora,
    insumo_id: f.insumoId,
    peso_toneladas: f.pesoToneladas,
    km_rodados: f.kmRodados,
    valor_tkm: f.valorTkm,
    valor_total: f.valorTotal,
    nota_fiscal: f.notaFiscal,
    observacoes: f.observacoes,
  };
}

// ── Funcionarios ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToFuncionario(row: any): Funcionario {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    cpf: row.cpf,
    telefone: row.telefone,
    dataNascimento: row.data_nascimento,
    endereco: row.endereco ?? { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' },
    senha: '', // not stored in DB anymore
    status: row.status,
    cargo: row.cargo,
    dataAdmissao: row.data_admissao,
    observacoes: row.observacoes,
    dataCriacao: row.data_criacao,
    dataAtualizacao: row.data_atualizacao,
    acoesPermitidas: row.acoes_permitidas,
    authUserId: row.auth_user_id,
  };
}

export function funcionarioToDb(f: Funcionario) {
  return {
    id: f.id,
    nome: f.nome,
    email: f.email,
    cpf: f.cpf,
    telefone: f.telefone,
    data_nascimento: f.dataNascimento,
    endereco: f.endereco,
    status: f.status,
    cargo: f.cargo,
    data_admissao: f.dataAdmissao,
    observacoes: f.observacoes,
    data_criacao: f.dataCriacao,
    data_atualizacao: f.dataAtualizacao,
    acoes_permitidas: f.acoesPermitidas,
    auth_user_id: (f as Funcionario & { authUserId?: string }).authUserId,
  };
}

// ── Perfil Permissao ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToPerfilPermissao(row: any): PerfilPermissao {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    permissoes: row.permissoes,
  };
}

export function perfilPermissaoToDb(p: PerfilPermissao) {
  return {
    id: p.id,
    funcionario_id: p.funcionarioId,
    permissoes: p.permissoes,
  };
}

// ── Audit Log ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToAuditLog(row: any): AuditLogEntry {
  return {
    id: row.id,
    tipo: row.tipo,
    funcionarioId: row.funcionario_id,
    alvoId: row.alvo_id,
    detalhes: row.detalhes,
    dataHora: row.data_hora,
  };
}

export function auditLogToDb(a: Omit<AuditLogEntry, 'id' | 'dataHora'>) {
  return {
    tipo: a.tipo,
    funcionario_id: a.funcionarioId,
    alvo_id: a.alvoId,
    detalhes: a.detalhes,
  };
}

// ── Alocacoes (helper for JSON columns) ──

export function alocacoesToDb(alocacoes: AlocacaoEtapa[]) {
  return alocacoes.map(a => ({
    etapa_id: a.etapaId,
    percentual: a.percentual,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToAlocacoes(data: any[]): AlocacaoEtapa[] {
  if (!data) return [];
  return data.map(a => ({
    etapaId: a.etapa_id ?? a.etapaId,
    percentual: a.percentual,
  }));
}
