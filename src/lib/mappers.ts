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
  CategoriaMaterial,
  TipoInsumoEntity,
  EntradaMaterial,
  SaidaMaterial,
  TransferenciaMaterial,
  Localidade,
  Frete,
  PagamentoFrete,
  AbastecimentoCarreta,
  Funcionario,
  PerfilPermissao,
  AuditLogEntry,
  AlocacaoEtapa,
  PedidoMaterial,
  ItemPedidoMaterial,
  PedidoCompra,
  Cotacao,
  OrdemCompra,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: o.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: e.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: d.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: a.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: e.criadoPor,
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
    tipoMedicao: row.tipo_medicao ?? 'horimetro',
    medicaoInicial: Number(row.medicao_inicial) || 0,
    ativo: row.ativo ?? true,
    dataAquisicao: row.data_aquisicao ?? '',
    dataVenda: row.data_venda ?? '',
    criadoPor: row.criado_por ?? '',
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
    criado_por: e.criadoPor,
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
    criadoPor: row.criado_por ?? '',
    categoria: row.categoria ?? undefined,
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
    criado_por: i.criadoPor,
    categoria: i.categoria ?? null,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: t.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: f.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: d.criadoPor,
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
    criadoPor: row.criado_por ?? '',
  };
}

export function unidadeMedidaToDb(u: UnidadeMedida) {
  return {
    id: u.id,
    nome: u.nome,
    sigla: u.sigla,
    ativo: u.ativo,
    criado_por: u.criadoPor,
  };
}

// ── Categorias Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToCategoriaMaterial(row: any): CategoriaMaterial {
  return {
    id: row.id,
    nome: row.nome,
    valor: row.valor,
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
  };
}

export function categoriaMaterialToDb(c: CategoriaMaterial) {
  return {
    id: c.id,
    nome: c.nome,
    valor: c.valor,
    ativo: c.ativo,
    criado_por: c.criadoPor,
  };
}

// ── Tipos Insumo ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTipoInsumo(row: any): TipoInsumoEntity {
  return {
    id: row.id,
    nome: row.nome,
    valor: row.valor,
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
  };
}

export function tipoInsumoToDb(t: TipoInsumoEntity) {
  return {
    id: t.id,
    nome: t.nome,
    valor: t.valor,
    ativo: t.ativo,
    criado_por: t.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: e.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: s.criadoPor,
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
    criadoPor: row.criado_por ?? '',
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
    criado_por: t.criadoPor,
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
    criadoPor: row.criado_por ?? '',
  };
}

export function localidadeToDb(l: Localidade) {
  return {
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
    ativo: l.ativo,
    criado_por: l.criadoPor,
  };
}

// ── Fretes ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToFrete(row: any): Frete {
  return {
    id: row.id,
    data: row.data,
    dataChegada: row.data_chegada ?? '',
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
    placaCarreta: row.placa_carreta ?? '',
    motorista: row.motorista ?? '',
    observacoes: row.observacoes,
    criadoPor: row.criado_por ?? '',
  };
}

export function freteToDb(f: Frete) {
  return {
    id: f.id,
    data: f.data,
    data_chegada: f.dataChegada || '',
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
    placa_carreta: f.placaCarreta,
    motorista: f.motorista,
    observacoes: f.observacoes,
    criado_por: f.criadoPor,
  };
}

// ── Pagamentos Frete ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToPagamentoFrete(row: any): PagamentoFrete {
  return {
    id: row.id,
    data: row.data,
    transportadora: row.transportadora,
    mesReferencia: row.mes_referencia,
    valor: Number(row.valor),
    metodo: row.metodo,
    quantidadeCombustivel: Number(row.quantidade_combustivel),
    responsavel: row.responsavel,
    notaFiscal: row.nota_fiscal,
    pagoPor: row.pago_por ?? '',
    observacoes: row.observacoes,
    criadoPor: row.criado_por ?? '',
  };
}

export function pagamentoFreteToDb(p: PagamentoFrete) {
  return {
    id: p.id,
    data: p.data,
    transportadora: p.transportadora,
    mes_referencia: p.mesReferencia,
    valor: p.valor,
    metodo: p.metodo,
    quantidade_combustivel: p.quantidadeCombustivel,
    responsavel: p.responsavel,
    nota_fiscal: p.notaFiscal,
    pago_por: p.pagoPor,
    observacoes: p.observacoes,
    criado_por: p.criadoPor,
  };
}

// ── Abastecimentos Carreta ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToAbastecimentoCarreta(row: any): AbastecimentoCarreta {
  return {
    id: row.id,
    data: row.data,
    transportadora: row.transportadora,
    placaCarreta: row.placa_carreta,
    mesReferencia: row.mes_referencia ?? '',
    tipoCombustivel: row.tipo_combustivel,
    quantidadeLitros: Number(row.quantidade_litros),
    valorUnidade: Number(row.valor_unidade),
    valorTotal: Number(row.valor_total),
    observacoes: row.observacoes,
    criadoPor: row.criado_por ?? '',
  };
}

export function abastecimentoCarretaToDb(a: AbastecimentoCarreta) {
  return {
    id: a.id,
    data: a.data,
    transportadora: a.transportadora,
    placa_carreta: a.placaCarreta,
    mes_referencia: a.mesReferencia,
    tipo_combustivel: a.tipoCombustivel,
    quantidade_litros: a.quantidadeLitros,
    valor_unidade: a.valorUnidade,
    valor_total: a.valorTotal,
    observacoes: a.observacoes,
    criado_por: a.criadoPor,
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

// ── Pedidos Material ──

function dbToItemPedidoMaterial(item: { insumo_id?: string; insumoId?: string; quantidade: number; valor_unitario?: number; valorUnitario?: number }): ItemPedidoMaterial {
  return {
    insumoId: item.insumo_id ?? item.insumoId ?? '',
    quantidade: Number(item.quantidade),
    valorUnitario: Number(item.valor_unitario ?? item.valorUnitario ?? 0),
  };
}

function itemPedidoMaterialToDb(item: ItemPedidoMaterial) {
  return {
    insumo_id: item.insumoId,
    quantidade: item.quantidade,
    valor_unitario: item.valorUnitario,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToPedidoMaterial(row: any): PedidoMaterial {
  const rawItens = row.itens ?? [];
  return {
    id: row.id,
    data: row.data,
    fornecedorId: row.fornecedor_id ?? '',
    itens: Array.isArray(rawItens) ? rawItens.map(dbToItemPedidoMaterial) : [],
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
  };
}

export function pedidoMaterialToDb(p: PedidoMaterial) {
  return {
    id: p.id,
    data: p.data,
    fornecedor_id: p.fornecedorId,
    itens: p.itens.map(itemPedidoMaterialToDb),
    observacoes: p.observacoes,
    criado_por: p.criadoPor,
  };
}

// ── Pedidos Compra ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToPedidoCompra(row: any): PedidoCompra {
  return {
    id: row.id,
    numero: row.numero ?? '',
    data: row.data,
    obraId: row.obra_id ?? '',
    solicitante: row.solicitante ?? '',
    urgencia: row.urgencia ?? 'normal',
    status: row.status ?? 'pendente',
    observacoes: row.observacoes ?? '',
    itens: Array.isArray(row.itens) ? row.itens.map((i: { id?: string; descricao?: string; categoria?: string; quantidade?: number; unidade?: string }) => ({
      id: i.id ?? '',
      descricao: i.descricao ?? '',
      categoria: i.categoria ?? 'outros',
      quantidade: Number(i.quantidade ?? 0),
      unidade: i.unidade ?? 'un',
    })) : [],
    criadoPor: row.criado_por ?? '',
  };
}

export function pedidoCompraToDb(p: PedidoCompra) {
  return {
    id: p.id,
    numero: p.numero,
    data: p.data,
    obra_id: p.obraId,
    solicitante: p.solicitante,
    urgencia: p.urgencia,
    status: p.status,
    observacoes: p.observacoes,
    itens: p.itens,
    criado_por: p.criadoPor,
  };
}

// ── Cotacoes ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToCotacao(row: any): Cotacao {
  return {
    id: row.id,
    numero: row.numero ?? '',
    descricao: row.descricao ?? '',
    data: row.data,
    pedidoCompraId: row.pedido_compra_id ?? '',
    prazoResposta: row.prazo_resposta ?? '',
    status: row.status ?? 'em_cotacao',
    fornecedores: Array.isArray(row.fornecedores) ? row.fornecedores : [],
    itensPedido: Array.isArray(row.itens_pedido) ? row.itens_pedido : [],
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
  };
}

export function cotacaoToDb(c: Cotacao) {
  return {
    id: c.id,
    numero: c.numero,
    descricao: c.descricao,
    data: c.data,
    pedido_compra_id: c.pedidoCompraId || null,
    prazo_resposta: c.prazoResposta,
    status: c.status,
    fornecedores: c.fornecedores,
    itens_pedido: c.itensPedido,
    observacoes: c.observacoes,
    criado_por: c.criadoPor,
  };
}

// ── Ordens Compra ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToOrdemCompra(row: any): OrdemCompra {
  return {
    id: row.id,
    numero: row.numero ?? '',
    dataCriacao: row.data_criacao,
    dataEntrega: row.data_entrega ?? '',
    obraId: row.obra_id ?? '',
    etapaObraId: row.etapa_obra_id ?? '',
    fornecedorId: row.fornecedor_id ?? '',
    cotacaoId: row.cotacao_id ?? '',
    pedidoCompraId: row.pedido_compra_id ?? '',
    itens: Array.isArray(row.itens) ? row.itens : [],
    custosAdicionais: row.custos_adicionais ?? { frete: 0, outrasDespesas: 0, impostos: 0, desconto: 0 },
    totalMateriais: Number(row.total_materiais ?? 0),
    totalGeral: Number(row.total_geral ?? 0),
    condicaoPagamento: row.condicao_pagamento ?? '',
    formaPagamento: row.forma_pagamento ?? '',
    parcelas: Array.isArray(row.parcelas) ? row.parcelas : [],
    prazoEntrega: row.prazo_entrega ?? '',
    status: row.status ?? 'emitida',
    observacoes: row.observacoes ?? '',
    entradaInsumos: row.entrada_insumos ?? false,
    criadoPor: row.criado_por ?? '',
  };
}

export function ordemCompraToDb(o: OrdemCompra) {
  return {
    id: o.id,
    numero: o.numero,
    data_criacao: o.dataCriacao,
    data_entrega: o.dataEntrega || null,
    obra_id: o.obraId || null,
    etapa_obra_id: o.etapaObraId || null,
    fornecedor_id: o.fornecedorId || null,
    cotacao_id: o.cotacaoId || null,
    pedido_compra_id: o.pedidoCompraId || null,
    itens: o.itens,
    custos_adicionais: o.custosAdicionais,
    total_materiais: o.totalMateriais,
    total_geral: o.totalGeral,
    condicao_pagamento: o.condicaoPagamento,
    forma_pagamento: o.formaPagamento,
    parcelas: o.parcelas,
    prazo_entrega: o.prazoEntrega,
    status: o.status,
    observacoes: o.observacoes,
    entrada_insumos: o.entradaInsumos,
    criado_por: o.criadoPor,
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
