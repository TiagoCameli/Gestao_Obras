import type {
  Obra,
  EtapaObra,
  Deposito,
  EntradaCombustivel,
  Equipamento,
  Insumo,
  TransferenciaCombustivel,
  Fornecedor,
  DepositoMaterial,
  UnidadeMedida,
  CategoriaMaterial,
  TipoInsumoEntity,
  TipoEquipamentoEntity,
  EntradaMaterial,
  SaidaMaterial,
  TransferenciaMaterial,
  Localidade,
  Frete,
  PagamentoFrete,
  Funcionario,
  PerfilPermissao,
  AuditLogEntry,
  AlocacaoEtapa,
  PedidoMaterial,
  ItemPedidoMaterial,
  PedidoCompra,
  Cotacao,
  OrdemCompra,
  Empresa,
  Colaborador,
  MedicaoEquipamento,
  DocumentoEquipamento,
  HistoricoStatusEquipamento,
  EspecificacoesEquipamento,
  FiltrosEquipamento,
  FinanceiroEquipamento,
  OrdemServico,
  OSPeca,
  OSMaoObra,
  OSTransicao,
  StatusOS,
  StatusEquipamento,
  SaidaCombustivel,
  TransportadoraMovimento,
  TransportadoraSaldo,
  RecebimentoOC,
  ItemRecebimentoOC,
  CategoriaFinanceira,
  LancamentoFinanceiro,
  ParcelaLancamento,
  RateioLancamento,
  PagamentoLancamento,
  StatusLancamento,
  OrigemLancamento,
  TipoDestinoRateio,
  StatusParcelaLancamento,
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
    capacidadeLitros: Number(row.capacidade_litros),
    nivelAtualLitros: Number(row.nivel_atual_litros),
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
    transportadoraProprietariaId: row.transportadora_proprietaria_id ?? null,
    apelido: row.apelido ?? null,
    ehExterno: row.eh_externo ?? false,
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    combustivelAtualId: row.combustivel_atual_id ?? null,
  };
}

export function depositoToDb(d: Deposito) {
  return {
    id: d.id,
    nome: d.nome,
    capacidade_litros: d.capacidadeLitros,
    nivel_atual_litros: d.nivelAtualLitros,
    ativo: d.ativo,
    criado_por: d.criadoPor,
    transportadora_proprietaria_id: d.transportadoraProprietariaId,
    apelido: d.apelido,
    eh_externo: d.ehExterno,
    foto_urls: d.fotoUrls ?? [],
    arquivo_urls: d.arquivoUrls ?? [],
    // combustivel_atual_id é derivado por trigger — não mandar em INSERT/UPDATE
    // pra evitar override acidental do estado calculado.
  };
}

// ── Abastecimentos ──

// ── Entradas Combustivel ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEntradaCombustivel(row: any): EntradaCombustivel {
  return {
    id: row.id,
    dataHora: row.data_hora,
    depositoId: row.deposito_id,
    tipoCombustivel: row.tipo_combustivel,
    quantidadeLitros: Number(row.quantidade_litros),
    valorTotal: Number(row.valor_total),
    fornecedor: row.fornecedor,
    notaFiscal: row.nota_fiscal,
    observacoes: row.observacoes,
    criadoPor: row.criado_por ?? '',
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
  };
}

export function entradaCombustivelToDb(e: EntradaCombustivel) {
  return {
    id: e.id,
    data_hora: e.dataHora,
    deposito_id: e.depositoId,
    tipo_combustivel: e.tipoCombustivel,
    quantidade_litros: e.quantidadeLitros,
    valor_total: e.valorTotal,
    fornecedor: e.fornecedor,
    nota_fiscal: e.notaFiscal,
    observacoes: e.observacoes,
    criado_por: e.criadoPor,
    foto_urls: e.fotoUrls ?? [],
    arquivo_urls: e.arquivoUrls ?? [],
  };
}

// ── Equipamentos ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEquipamento(row: any): Equipamento {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo ?? '',
    empresaId: row.empresa_id ?? '',
    codigoPatrimonio: row.codigo_patrimonio,
    numeroSerie: row.numero_serie,
    ano: row.ano,
    marca: row.marca,
    modelo: row.modelo ?? '',
    propriedade: row.propriedade === 'alugada' ? 'alugada' : 'propria',
    status: ['ativa', 'manutencao_corretiva', 'manutencao_preventiva', 'fora_funcionamento'].includes(row.status)
      ? row.status
      : 'ativa',
    tipoMedicao: row.tipo_medicao ?? 'horimetro',
    medicaoInicial: Number(row.medicao_inicial) || 0,
    ativo: row.ativo ?? true,
    dataAquisicao: row.data_aquisicao ?? '',
    dataVenda: row.data_venda ?? '',
    criadoPor: row.criado_por ?? '',
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
  };
}

export function equipamentoToDb(e: Equipamento) {
  return {
    id: e.id,
    nome: e.nome,
    tipo: e.tipo,
    empresa_id: e.empresaId,
    codigo_patrimonio: e.codigoPatrimonio,
    numero_serie: e.numeroSerie,
    ano: e.ano,
    marca: e.marca,
    modelo: e.modelo,
    propriedade: e.propriedade,
    status: e.status,
    tipo_medicao: e.tipoMedicao,
    medicao_inicial: e.medicaoInicial,
    ativo: e.ativo,
    data_aquisicao: e.dataAquisicao,
    data_venda: e.dataVenda,
    criado_por: e.criadoPor,
    foto_urls: e.fotoUrls,
    arquivo_urls: e.arquivoUrls,
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
    usadoEmManutencao: !!row.usado_em_manutencao,
    codigoSku: row.codigo_sku ?? '',
    codigoEan: row.codigo_ean ?? '',
    fabricante: row.fabricante ?? '',
    codigoFabricante: row.codigo_fabricante ?? '',
    estoqueMinimo: row.estoque_minimo != null ? Number(row.estoque_minimo) : null,
    estoqueMaximo: row.estoque_maximo != null ? Number(row.estoque_maximo) : null,
    leadTimeDias: row.lead_time_dias != null ? Number(row.lead_time_dias) : null,
    equipamentosCompativeis: row.equipamentos_compativeis ?? [],
    fotoUrl: row.foto_url ?? '',
    aplicacaoTecnica: row.aplicacao_tecnica ?? '',
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
    usado_em_manutencao: !!i.usadoEmManutencao,
    codigo_sku: i.codigoSku || null,
    codigo_ean: i.codigoEan || null,
    fabricante: i.fabricante || null,
    codigo_fabricante: i.codigoFabricante || null,
    estoque_minimo: i.estoqueMinimo ?? null,
    estoque_maximo: i.estoqueMaximo ?? null,
    lead_time_dias: i.leadTimeDias ?? null,
    equipamentos_compativeis: i.equipamentosCompativeis ?? [],
    foto_url: i.fotoUrl || null,
    aplicacao_tecnica: i.aplicacaoTecnica || null,
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
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    tipoCombustivel: row.tipo_combustivel ?? null,
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
    foto_urls: t.fotoUrls ?? [],
    arquivo_urls: t.arquivoUrls ?? [],
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
    ehTransportadora: row.eh_transportadora ?? false,
    taxaLitroPadrao: Number(row.taxa_litro_padrao ?? 0),
    ehDonaDeTanque: row.eh_dona_de_tanque ?? false,
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
    eh_transportadora: f.ehTransportadora,
    taxa_litro_padrao: f.taxaLitroPadrao,
    eh_dona_de_tanque: f.ehDonaDeTanque,
  };
}

// ── Depositos Material ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToDepositoMaterial(row: any): DepositoMaterial {
  return {
    id: row.id,
    nome: row.nome,
    obraId: row.obra_id ?? '',
    endereco: row.endereco ?? '',
    responsavel: row.responsavel ?? '',
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
    // v2 — campos de auditoria/soft delete (obrasIds vem de junction, populado no hook)
    ehAlmoxarifadoPecas: row.eh_almoxarifado_pecas ?? false,
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function depositoMaterialToDb(d: DepositoMaterial) {
  return {
    id: d.id,
    nome: d.nome,
    obra_id: d.obraId || null,
    endereco: d.endereco,
    responsavel: d.responsavel,
    ativo: d.ativo,
    criado_por: d.criadoPor,
    eh_almoxarifado_pecas: d.ehAlmoxarifadoPecas ?? false,
    atualizado_por: d.atualizadoPor ?? null,
    deletado_em: d.deletadoEm ?? null,
    deletado_por: d.deletadoPor ?? null,
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
    obraId: row.obra_id ?? '',
    quantidade: Number(row.quantidade),
    valorUnitario: row.valor_unitario != null ? Number(row.valor_unitario) : undefined,
    valorTotal: Number(row.valor_total),
    fornecedorId: row.fornecedor_id ?? '',
    notaFiscal: row.nota_fiscal ?? '',
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function entradaMaterialToDb(e: EntradaMaterial) {
  return {
    id: e.id,
    data_hora: e.dataHora,
    deposito_material_id: e.depositoMaterialId,
    insumo_id: e.insumoId,
    obra_id: e.obraId || null,
    quantidade: e.quantidade,
    valor_unitario: e.valorUnitario ?? null,
    valor_total: e.valorTotal,
    fornecedor_id: e.fornecedorId,
    nota_fiscal: e.notaFiscal,
    observacoes: e.observacoes,
    criado_por: e.criadoPor,
    atualizado_por: e.atualizadoPor ?? null,
    deletado_em: e.deletadoEm ?? null,
    deletado_por: e.deletadoPor ?? null,
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
    obraId: row.obra_id ?? '',
    quantidade: Number(row.quantidade),
    valorTotal: Number(row.valor_total),
    alocacoes: row.alocacoes ?? [],
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
    // v2
    tipoSaida: row.tipo_saida ?? 'consumo',
    motivoPerda: row.motivo_perda ?? undefined,
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function saidaMaterialToDb(s: SaidaMaterial) {
  return {
    id: s.id,
    data_hora: s.dataHora,
    deposito_material_id: s.depositoMaterialId,
    insumo_id: s.insumoId,
    obra_id: s.obraId || null,
    quantidade: s.quantidade,
    valor_total: s.valorTotal,
    alocacoes: s.alocacoes ?? [],
    observacoes: s.observacoes,
    criado_por: s.criadoPor,
    tipo_saida: s.tipoSaida ?? 'consumo',
    motivo_perda: s.motivoPerda ?? null,
    atualizado_por: s.atualizadoPor ?? null,
    deletado_em: s.deletadoEm ?? null,
    deletado_por: s.deletadoPor ?? null,
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
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
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
    atualizado_por: t.atualizadoPor ?? null,
    deletado_em: t.deletadoEm ?? null,
    deletado_por: t.deletadoPor ?? null,
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
    notaFiscal2: row.nota_fiscal2 ?? '',
    placaCarreta: row.placa_carreta ?? '',
    motorista: row.motorista ?? '',
    valorMaterial: Number(row.valor_material ?? 0),
    observacoes: row.observacoes,
    criadoPor: row.criado_por ?? '',
    // FF.3 — anexos + foto chegada.
    fotoUrls: Array.isArray(row.foto_urls) ? row.foto_urls : [],
    arquivoUrls: Array.isArray(row.arquivo_urls) ? row.arquivo_urls : [],
    fotoChegadaUrl: row.foto_chegada_url ?? null,
    // FF.1 — audit fields (read-only no client; preenchidos por triggers).
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
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
    nota_fiscal2: f.notaFiscal2,
    placa_carreta: f.placaCarreta,
    motorista: f.motorista,
    valor_material: f.valorMaterial,
    observacoes: f.observacoes,
    criado_por: f.criadoPor,
    // FF.3 — anexos + foto chegada.
    foto_urls: f.fotoUrls ?? [],
    arquivo_urls: f.arquivoUrls ?? [],
    foto_chegada_url: f.fotoChegadaUrl ?? null,
    // FF.1 — audit (created_by/updated_by/deleted_by setados explicitamente
    // pelos hooks de mutate; demais (created_at/updated_at) ficam pro DB).
    created_by: f.createdBy ?? null,
    updated_by: f.updatedBy ?? null,
    deleted_at: f.deletedAt ?? null,
    deleted_by: f.deletedBy ?? null,
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
    // FF.3 — anexos.
    fotoUrls: Array.isArray(row.foto_urls) ? row.foto_urls : [],
    arquivoUrls: Array.isArray(row.arquivo_urls) ? row.arquivo_urls : [],
    // FF.1 — audit.
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
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
    // FF.3 — anexos.
    foto_urls: p.fotoUrls ?? [],
    arquivo_urls: p.arquivoUrls ?? [],
    // FF.1 — audit.
    created_by: p.createdBy ?? null,
    updated_by: p.updatedBy ?? null,
    deleted_at: p.deletedAt ?? null,
    deleted_by: p.deletedBy ?? null,
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
    // FF.3 — anexos.
    fotoUrls: Array.isArray(row.foto_urls) ? row.foto_urls : [],
    arquivoUrls: Array.isArray(row.arquivo_urls) ? row.arquivo_urls : [],
    // FF.1 — audit.
    createdAt: row.created_at ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
    deletedAt: row.deleted_at ?? null,
    deletedBy: row.deleted_by ?? null,
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
    // FF.3 — anexos.
    foto_urls: p.fotoUrls ?? [],
    arquivo_urls: p.arquivoUrls ?? [],
    // FF.1 — audit.
    created_by: p.createdBy ?? null,
    updated_by: p.updatedBy ?? null,
    deleted_at: p.deletedAt ?? null,
    deleted_by: p.deletedBy ?? null,
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
    descricaoLivre: row.descricao_livre ?? '',
    valorEstimado: row.valor_estimado != null ? Number(row.valor_estimado) : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itens: Array.isArray(row.itens) ? row.itens.map((i: any) => ({
      id: i.id ?? '',
      descricao: i.descricao ?? '',
      categoria: i.categoria ?? 'outros',
      quantidade: Number(i.quantidade ?? 0),
      unidade: i.unidade ?? 'un',
      tipo: i.tipo ?? 'material',
      insumoId: i.insumoId ?? i.insumo_id ?? undefined,
      criarNaBase: i.criarNaBase ?? false,
      // v2.5 — destino por item (opcional no pedido)
      tipoDestino: i.tipoDestino ?? undefined,
      etapaObraId: i.etapaObraId ?? undefined,
      depositoDestinoId: i.depositoDestinoId ?? undefined,
      equipamentoId: i.equipamentoId ?? undefined,
      osId: i.osId ?? undefined,
      obraId: i.obraId ?? undefined,
    })) : [],
    criadoPor: row.criado_por ?? '',
    aprovadoPor: row.aprovado_por ?? undefined,
    aprovadoEm: row.aprovado_em ?? undefined,
    reprovadoPor: row.reprovado_por ?? undefined,
    reprovadoEm: row.reprovado_em ?? undefined,
    motivoReprovacao: row.motivo_reprovacao ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function pedidoCompraToDb(p: PedidoCompra) {
  return {
    id: p.id,
    numero: p.numero,
    data: p.data,
    obra_id: p.obraId || null,
    solicitante: p.solicitante,
    urgencia: p.urgencia,
    status: p.status,
    observacoes: p.observacoes,
    descricao_livre: p.descricaoLivre ?? '',
    valor_estimado: p.valorEstimado ?? null,
    itens: p.itens,
    criado_por: p.criadoPor,
    aprovado_por: p.aprovadoPor ?? null,
    aprovado_em: p.aprovadoEm ?? null,
    reprovado_por: p.reprovadoPor ?? null,
    reprovado_em: p.reprovadoEm ?? null,
    motivo_reprovacao: p.motivoReprovacao ?? null,
    atualizado_por: p.atualizadoPor ?? null,
    deletado_em: p.deletadoEm ?? null,
    deletado_por: p.deletadoPor ?? null,
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
    prazoRespostaAt: row.prazo_resposta_at ?? undefined,
    descricaoLivre: row.descricao_livre ?? '',
    status: row.status ?? 'em_cotacao',
    fornecedores: Array.isArray(row.fornecedores) ? row.fornecedores : [],
    itensPedido: Array.isArray(row.itens_pedido) ? row.itens_pedido : [],
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
    canceladaPor: row.cancelada_por ?? undefined,
    canceladaEm: row.cancelada_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
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
    prazo_resposta_at: c.prazoRespostaAt ?? null,
    descricao_livre: c.descricaoLivre ?? '',
    status: c.status,
    fornecedores: c.fornecedores,
    itens_pedido: c.itensPedido,
    observacoes: c.observacoes,
    criado_por: c.criadoPor,
    cancelada_por: c.canceladaPor ?? null,
    cancelada_em: c.canceladaEm ?? null,
    atualizado_por: c.atualizadoPor ?? null,
    deletado_em: c.deletadoEm ?? null,
    deletado_por: c.deletadoPor ?? null,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itens: Array.isArray(row.itens) ? row.itens.map((i: any) => ({
      id: i.id ?? '',
      descricao: i.descricao ?? '',
      quantidade: Number(i.quantidade ?? 0),
      unidade: i.unidade ?? 'un',
      precoUnitario: Number(i.precoUnitario ?? 0),
      subtotal: Number(i.subtotal ?? 0),
      obraId: i.obraId ?? '',
      etapaObraId: i.etapaObraId ?? '',
      tipo: i.tipo ?? 'material',
      marca: i.marca ?? undefined,
      insumoId: i.insumoId ?? undefined,
      // v2.5 — destino por item (preserva quando vier do banco)
      tipoDestino: i.tipoDestino ?? undefined,
      depositoDestinoId: i.depositoDestinoId ?? undefined,
      equipamentoId: i.equipamentoId ?? undefined,
      osId: i.osId ?? undefined,
    })) : [],
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
    entradaGerada: row.entrada_gerada ?? false,
    empresaFaturamento: row.empresa_faturamento ?? '',
    aprovada: row.aprovada ?? false,
    criadoPor: row.criado_por ?? '',
    tipoDestino: row.tipo_destino ?? undefined,
    equipamentoId: row.equipamento_id ?? undefined,
    depositoDestinoId: row.deposito_destino_id ?? undefined,
    aprovadaPor: row.aprovada_por ?? undefined,
    aprovadaEm: row.aprovada_em ?? undefined,
    canceladaPor: row.cancelada_por ?? undefined,
    canceladaEm: row.cancelada_em ?? undefined,
    recebidaPor: row.recebida_por ?? undefined,
    recebidaEm: row.recebida_em ?? undefined,
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    lancamentoFinanceiroStatus: row.lancamento_financeiro_status ?? 'nao_aplicavel',
    lancadoFinanceiroEm: row.lancado_financeiro_em ?? undefined,
    lancadoFinanceiroPor: row.lancado_financeiro_por ?? undefined,
    lancamentoFinanceiroId: row.lancamento_financeiro_id ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
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
    entrada_gerada: o.entradaGerada,
    empresa_faturamento: o.empresaFaturamento,
    aprovada: o.aprovada,
    criado_por: o.criadoPor,
    tipo_destino: o.tipoDestino ?? null,
    equipamento_id: o.equipamentoId || null,
    deposito_destino_id: o.depositoDestinoId || null,
    aprovada_por: o.aprovadaPor ?? null,
    aprovada_em: o.aprovadaEm ?? null,
    cancelada_por: o.canceladaPor ?? null,
    cancelada_em: o.canceladaEm ?? null,
    recebida_por: o.recebidaPor ?? null,
    recebida_em: o.recebidaEm ?? null,
    atualizado_por: o.atualizadoPor ?? null,
    lancamento_financeiro_status: o.lancamentoFinanceiroStatus ?? 'nao_aplicavel',
    lancado_financeiro_em: o.lancadoFinanceiroEm ?? null,
    lancado_financeiro_por: o.lancadoFinanceiroPor ?? null,
    lancamento_financeiro_id: o.lancamentoFinanceiroId ?? null,
    deletado_em: o.deletadoEm ?? null,
    deletado_por: o.deletadoPor ?? null,
  };
}

// ── Empresas ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEmpresa(row: any): Empresa {
  return {
    id: row.id,
    nome: row.nome,
    cnpj: row.cnpj ?? '',
    endereco: row.endereco ?? '',
    areaAtuacao: row.area_atuacao ?? '',
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
  };
}

export function empresaToDb(e: Empresa) {
  return {
    id: e.id,
    nome: e.nome,
    cnpj: e.cnpj,
    endereco: e.endereco,
    area_atuacao: e.areaAtuacao,
    ativo: e.ativo,
    criado_por: e.criadoPor,
  };
}

// ── Colaboradores ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToColaborador(row: any): Colaborador {
  return {
    id: row.id,
    nome: row.nome,
    empresaId: row.empresa_id,
    dataNascimento: row.data_nascimento ?? '',
    dataIngresso: row.data_ingresso ?? '',
    telefone: row.telefone ?? '',
    email: row.email ?? '',
    altura: row.altura ?? '',
    tamanhoCamisa: row.tamanho_camisa ?? '',
    tamanhoCalca: row.tamanho_calca ?? '',
    tamanhoSapato: row.tamanho_sapato ?? '',
    endereco: row.endereco ?? '',
    cpf: row.cpf ?? '',
    rg: row.rg ?? '',
    observacoes: row.observacoes ?? '',
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
    // PR28 — vínculo opcional para unificação com apont_funcionarios
    apontFuncionarioId: row.apont_funcionario_id ?? undefined,
  };
}

export function colaboradorToDb(c: Colaborador) {
  return {
    id: c.id,
    nome: c.nome,
    empresa_id: c.empresaId,
    data_nascimento: c.dataNascimento,
    data_ingresso: c.dataIngresso,
    telefone: c.telefone,
    email: c.email,
    altura: c.altura,
    tamanho_camisa: c.tamanhoCamisa,
    tamanho_calca: c.tamanhoCalca,
    tamanho_sapato: c.tamanhoSapato,
    endereco: c.endereco,
    cpf: c.cpf,
    rg: c.rg,
    observacoes: c.observacoes,
    ativo: c.ativo,
    criado_por: c.criadoPor,
    // PR28 — persiste o vínculo (NULL quando ainda não unificado)
    apont_funcionario_id: c.apontFuncionarioId ?? null,
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

// (Funções antigas dbToOrdemServico/dbToItemOS/dbToPlanoManutencao/
//  dbToHistoricoMedicao removidas — referenciavam tabelas wipadas em
//  20260503180000_wipe_manutencao_module. O novo OrdemServico vive abaixo
//  na seção "Ordens de Serviço (PR9 - Marco 2)".)

// ── Tipos Equipamento ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTipoEquipamento(row: any): TipoEquipamentoEntity {
  return {
    id: row.id,
    nome: row.nome,
    codigo: row.codigo,
    ativo: row.ativo,
    criadoPor: row.criado_por ?? '',
  };
}

export function tipoEquipamentoToDb(t: TipoEquipamentoEntity) {
  return {
    id: t.id,
    nome: t.nome,
    codigo: t.codigo,
    ativo: t.ativo,
    criado_por: t.criadoPor,
  };
}

// ── Medições de Equipamento (PR1 - Marco 0) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToMedicaoEquipamento(row: any): MedicaoEquipamento {
  return {
    id: row.id,
    equipamentoId: row.equipamento_id ?? '',
    data: row.data ?? '',
    tipoMedicao: row.tipo_medicao ?? 'horimetro',
    valor: Number(row.valor ?? 0),
    origem: row.origem ?? 'manual',
    origemId: row.origem_id ?? null,
    observacoes: row.observacoes ?? '',
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

export function medicaoEquipamentoToDb(m: MedicaoEquipamento) {
  return {
    id: m.id,
    equipamento_id: m.equipamentoId,
    data: m.data,
    tipo_medicao: m.tipoMedicao,
    valor: m.valor,
    origem: m.origem,
    origem_id: m.origemId,
    observacoes: m.observacoes,
    foto_urls: m.fotoUrls,
    arquivo_urls: m.arquivoUrls,
    created_by: m.createdBy,
  };
}

// ── Ordens de Serviço (PR9 - Marco 2) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToOrdemServico(row: any): OrdemServico {
  return {
    id: row.id,
    numero: row.numero ?? '',
    equipamentoId: row.equipamento_id ?? '',
    tipo: row.tipo ?? 'corretiva',
    prioridade: row.prioridade ?? 'media',
    status: row.status ?? 'aberta',
    origem: row.origem ?? null,
    origemId: row.origem_id ?? null,
    atividadeId: row.atividade_id ?? null,
    obraId: row.obra_id ?? null,
    solicitanteId: row.solicitante_id ?? '',
    responsavelId: row.responsavel_id ?? '',
    fornecedorServicoId: row.fornecedor_servico_id ?? null,
    dataAbertura: row.data_abertura ?? '',
    dataPrevistaInicio: row.data_prevista_inicio ?? null,
    dataInicioExecucao: row.data_inicio_execucao ?? null,
    dataConclusao: row.data_conclusao ?? null,
    prazoAtendimento: row.prazo_atendimento ?? null,
    medicaoAbertura: row.medicao_abertura != null ? Number(row.medicao_abertura) : null,
    medicaoConclusao: row.medicao_conclusao != null ? Number(row.medicao_conclusao) : null,
    paradaInicio: row.parada_inicio ?? null,
    paradaFim: row.parada_fim ?? null,
    defeitoReportado: row.defeito_reportado ?? '',
    sintomas: row.sintomas ?? [],
    sistemasAfetados: row.sistemas_afetados ?? [],
    causaRaiz: row.causa_raiz ?? '',
    solucaoAplicada: row.solucao_aplicada ?? '',
    recomendacoes: row.recomendacoes ?? '',
    custoPecas: Number(row.custo_pecas ?? 0),
    custoServicoTerceiro: Number(row.custo_servico_terceiro ?? 0),
    custoMaoObraPropria: Number(row.custo_mao_obra_propria ?? 0),
    custoTerceiros: Number(row.custo_terceiros ?? 0),
    custoOleos: Number(row.custo_oleos ?? 0),
    custoTotal: Number(row.custo_total ?? 0),
    aprovadoPor: row.aprovado_por ?? '',
    aprovadoEm: row.aprovado_em ?? null,
    garantiaAcionada: !!row.garantia_acionada,
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}

export function ordemServicoToDb(os: OrdemServico) {
  return {
    id: os.id,
    // numero: gerado no DB via gerar_numero_os(), não enviar aqui no INSERT
    equipamento_id: os.equipamentoId,
    tipo: os.tipo,
    prioridade: os.prioridade,
    status: os.status,
    origem: os.origem,
    origem_id: os.origemId,
    atividade_id: os.atividadeId,
    obra_id: os.obraId,
    solicitante_id: os.solicitanteId || null,
    responsavel_id: os.responsavelId || null,
    fornecedor_servico_id: os.fornecedorServicoId,
    data_prevista_inicio: os.dataPrevistaInicio,
    data_inicio_execucao: os.dataInicioExecucao,
    data_conclusao: os.dataConclusao,
    prazo_atendimento: os.prazoAtendimento,
    medicao_abertura: os.medicaoAbertura,
    medicao_conclusao: os.medicaoConclusao,
    parada_inicio: os.paradaInicio,
    parada_fim: os.paradaFim,
    defeito_reportado: os.defeitoReportado,
    sintomas: os.sintomas,
    sistemas_afetados: os.sistemasAfetados,
    causa_raiz: os.causaRaiz,
    solucao_aplicada: os.solucaoAplicada,
    recomendacoes: os.recomendacoes,
    custo_pecas: os.custoPecas,
    custo_servico_terceiro: os.custoServicoTerceiro,
    custo_mao_obra_propria: os.custoMaoObraPropria,
    aprovado_por: os.aprovadoPor || null,
    aprovado_em: os.aprovadoEm,
    garantia_acionada: os.garantiaAcionada,
    foto_urls: os.fotoUrls,
    arquivo_urls: os.arquivoUrls,
    observacoes: os.observacoes,
    created_by: os.createdBy,
    updated_by: os.updatedBy,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToOSPeca(row: any): OSPeca {
  return {
    id: row.id,
    osId: row.os_id ?? '',
    insumoId: row.insumo_id ?? '',
    depositoId: row.deposito_id ?? null,
    quantidade: Number(row.quantidade ?? 0),
    unidadeMedidaId: row.unidade_medida_id ?? null,
    custoUnitario: Number(row.custo_unitario ?? 0),
    custoTotal: Number(row.custo_total ?? 0),
    status: row.status ?? 'reservada',
    saidaMaterialId: row.saida_material_id ?? null,
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

export function osPecaToDb(p: OSPeca) {
  return {
    id: p.id,
    os_id: p.osId,
    insumo_id: p.insumoId,
    deposito_id: p.depositoId,
    quantidade: p.quantidade,
    unidade_medida_id: p.unidadeMedidaId,
    custo_unitario: p.custoUnitario,
    status: p.status,
    saida_material_id: p.saidaMaterialId,
    observacoes: p.observacoes,
    created_by: p.createdBy,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToOSMaoObra(row: any): OSMaoObra {
  return {
    id: row.id,
    osId: row.os_id ?? '',
    colaboradorId: row.colaborador_id ?? '',
    data: row.data ?? '',
    horas: Number(row.horas ?? 0),
    custoHora: row.custo_hora != null ? Number(row.custo_hora) : null,
    custoTotal: Number(row.custo_total ?? 0),
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

export function osMaoObraToDb(m: OSMaoObra) {
  return {
    id: m.id,
    os_id: m.osId,
    colaborador_id: m.colaboradorId,
    data: m.data,
    horas: m.horas,
    custo_hora: m.custoHora,
    observacoes: m.observacoes,
    created_by: m.createdBy,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToOSTransicao(row: any): OSTransicao {
  return {
    id: row.id,
    osId: row.os_id ?? '',
    statusDe: (row.status_de ?? null) as StatusOS | null,
    statusPara: (row.status_para ?? 'aberta') as StatusOS,
    motivo: row.motivo ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

// ── Financeiro do Equipamento (PR7 - Marco 1) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToFinanceiroEquipamento(row: any): FinanceiroEquipamento {
  return {
    equipamentoId: row.equipamento_id ?? '',
    valorAquisicao: row.valor_aquisicao != null ? Number(row.valor_aquisicao) : null,
    fornecedorAquisicaoId: row.fornecedor_aquisicao_id ?? null,
    nfAquisicao: row.nf_aquisicao ?? '',
    formaAquisicao: row.forma_aquisicao ?? null,
    bancoFinanciador: row.banco_financiador ?? '',
    valorParcela: row.valor_parcela != null ? Number(row.valor_parcela) : null,
    prestacoesTotal: row.prestacoes_total != null ? Number(row.prestacoes_total) : null,
    prestacoesPagas: row.prestacoes_pagas != null ? Number(row.prestacoes_pagas) : null,
    valorMercadoAtual: row.valor_mercado_atual != null ? Number(row.valor_mercado_atual) : null,
    vidaUtilMeses: row.vida_util_meses != null ? Number(row.vida_util_meses) : null,
    valorResidualEstimado: row.valor_residual_estimado != null ? Number(row.valor_residual_estimado) : null,
    locadoraId: row.locadora_id ?? null,
    contratoNumero: row.contrato_numero ?? '',
    valorMensal: row.valor_mensal != null ? Number(row.valor_mensal) : null,
    vigenciaInicio: row.vigencia_inicio ?? null,
    vigenciaFim: row.vigencia_fim ?? null,
    indexador: row.indexador ?? null,
    manutencaoInclusa: !!row.manutencao_inclusa,
    combustivelIncluso: !!row.combustivel_incluso,
    operadorIncluso: !!row.operador_incluso,
    horasMinimasMensais: row.horas_minimas_mensais != null ? Number(row.horas_minimas_mensais) : null,
    observacoes: row.observacoes ?? '',
    arquivoUrls: row.arquivo_urls ?? [],
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}

export function financeiroEquipamentoToDb(f: FinanceiroEquipamento) {
  return {
    equipamento_id: f.equipamentoId,
    valor_aquisicao: f.valorAquisicao,
    fornecedor_aquisicao_id: f.fornecedorAquisicaoId,
    nf_aquisicao: f.nfAquisicao,
    forma_aquisicao: f.formaAquisicao,
    banco_financiador: f.bancoFinanciador,
    valor_parcela: f.valorParcela,
    prestacoes_total: f.prestacoesTotal,
    prestacoes_pagas: f.prestacoesPagas,
    valor_mercado_atual: f.valorMercadoAtual,
    vida_util_meses: f.vidaUtilMeses,
    valor_residual_estimado: f.valorResidualEstimado,
    locadora_id: f.locadoraId,
    contrato_numero: f.contratoNumero,
    valor_mensal: f.valorMensal,
    vigencia_inicio: f.vigenciaInicio,
    vigencia_fim: f.vigenciaFim,
    indexador: f.indexador,
    manutencao_inclusa: f.manutencaoInclusa,
    combustivel_incluso: f.combustivelIncluso,
    operador_incluso: f.operadorIncluso,
    horas_minimas_mensais: f.horasMinimasMensais,
    observacoes: f.observacoes,
    arquivo_urls: f.arquivoUrls,
    created_by: f.createdBy,
    updated_by: f.updatedBy,
  };
}

// ── Especificações Técnicas do Equipamento (PR6 - Marco 1) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToEspecificacoesEquipamento(row: any): EspecificacoesEquipamento {
  return {
    equipamentoId: row.equipamento_id ?? '',
    capacidadeTanqueL: row.capacidade_tanque_l != null ? Number(row.capacidade_tanque_l) : null,
    capacidadeOleoMotorL: row.capacidade_oleo_motor_l != null ? Number(row.capacidade_oleo_motor_l) : null,
    tipoOleoMotor: row.tipo_oleo_motor ?? '',
    capacidadeOleoHidraulicoL: row.capacidade_oleo_hidraulico_l != null ? Number(row.capacidade_oleo_hidraulico_l) : null,
    tipoOleoHidraulico: row.tipo_oleo_hidraulico ?? '',
    capacidadeOleoTransmissaoL: row.capacidade_oleo_transmissao_l != null ? Number(row.capacidade_oleo_transmissao_l) : null,
    tipoOleoTransmissao: row.tipo_oleo_transmissao ?? '',
    capacidadeOleoDiferencialL: row.capacidade_oleo_diferencial_l != null ? Number(row.capacidade_oleo_diferencial_l) : null,
    capacidadeArrefecedorL: row.capacidade_arrefecedor_l != null ? Number(row.capacidade_arrefecedor_l) : null,
    pneuMedida: row.pneu_medida ?? '',
    pneuQtd: row.pneu_qtd != null ? Number(row.pneu_qtd) : null,
    bateriaEspecificacao: row.bateria_especificacao ?? '',
    bateriaQtd: row.bateria_qtd != null ? Number(row.bateria_qtd) : null,
    filtros: (row.filtros ?? {}) as FiltrosEquipamento,
    consumoEsperadoLH: row.consumo_esperado_l_h != null ? Number(row.consumo_esperado_l_h) : null,
    consumoEsperadoKmL: row.consumo_esperado_km_l != null ? Number(row.consumo_esperado_km_l) : null,
    garantiaFimData: row.garantia_fim_data ?? null,
    garantiaFimMedicao: row.garantia_fim_medicao != null ? Number(row.garantia_fim_medicao) : null,
    observacoesTecnicas: row.observacoes_tecnicas ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}

export function especificacoesEquipamentoToDb(e: EspecificacoesEquipamento) {
  return {
    equipamento_id: e.equipamentoId,
    capacidade_tanque_l: e.capacidadeTanqueL,
    capacidade_oleo_motor_l: e.capacidadeOleoMotorL,
    tipo_oleo_motor: e.tipoOleoMotor,
    capacidade_oleo_hidraulico_l: e.capacidadeOleoHidraulicoL,
    tipo_oleo_hidraulico: e.tipoOleoHidraulico,
    capacidade_oleo_transmissao_l: e.capacidadeOleoTransmissaoL,
    tipo_oleo_transmissao: e.tipoOleoTransmissao,
    capacidade_oleo_diferencial_l: e.capacidadeOleoDiferencialL,
    capacidade_arrefecedor_l: e.capacidadeArrefecedorL,
    pneu_medida: e.pneuMedida,
    pneu_qtd: e.pneuQtd,
    bateria_especificacao: e.bateriaEspecificacao,
    bateria_qtd: e.bateriaQtd,
    filtros: e.filtros,
    consumo_esperado_l_h: e.consumoEsperadoLH,
    consumo_esperado_km_l: e.consumoEsperadoKmL,
    garantia_fim_data: e.garantiaFimData,
    garantia_fim_medicao: e.garantiaFimMedicao,
    observacoes_tecnicas: e.observacoesTecnicas,
    created_by: e.createdBy,
    updated_by: e.updatedBy,
  };
}

// ── Histórico de Status de Equipamento (PR4 - Marco 0) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToHistoricoStatusEquipamento(row: any): HistoricoStatusEquipamento {
  return {
    id: row.id,
    equipamentoId: row.equipamento_id ?? '',
    statusDe: (row.status_de ?? null) as StatusEquipamento | null,
    statusPara: (row.status_para ?? 'ativa') as StatusEquipamento,
    motivo: row.motivo ?? '',
    observacoes: row.observacoes ?? '',
    osId: row.os_id ?? null,
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
  };
}

export function historicoStatusEquipamentoToDb(h: HistoricoStatusEquipamento) {
  return {
    id: h.id,
    equipamento_id: h.equipamentoId,
    status_de: h.statusDe,
    status_para: h.statusPara,
    motivo: h.motivo,
    observacoes: h.observacoes,
    os_id: h.osId,
    created_by: h.createdBy,
  };
}

// ── Documentos de Equipamento (PR3 - Marco 0) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToDocumentoEquipamento(row: any): DocumentoEquipamento {
  return {
    id: row.id,
    equipamentoId: row.equipamento_id ?? '',
    tipo: row.tipo ?? 'outro',
    numero: row.numero ?? '',
    emissao: row.emissao ?? null,
    vencimento: row.vencimento ?? null,
    valor: Number(row.valor ?? 0),
    fornecedorId: row.fornecedor_id ?? null,
    observacoes: row.observacoes ?? '',
    fotoUrls: row.foto_urls ?? [],
    arquivoUrls: row.arquivo_urls ?? [],
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}

export function documentoEquipamentoToDb(d: DocumentoEquipamento) {
  return {
    id: d.id,
    equipamento_id: d.equipamentoId,
    tipo: d.tipo,
    numero: d.numero,
    emissao: d.emissao,
    vencimento: d.vencimento,
    valor: d.valor,
    fornecedor_id: d.fornecedorId,
    observacoes: d.observacoes,
    foto_urls: d.fotoUrls,
    arquivo_urls: d.arquivoUrls,
    created_by: d.createdBy,
    updated_by: d.updatedBy,
  };
}

// ── Saidas Combustivel ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToSaidaCombustivel(row: any): SaidaCombustivel {
  return {
    id: row.id,
    data: row.data,
    origem: row.origem,
    tipoConsumidor: row.tipo_consumidor,
    tanqueId: row.tanque_id ?? null,
    equipamentoId: row.equipamento_id ?? null,
    transportadoraId: row.transportadora_id ?? null,
    placa: row.placa ?? null,
    motorista: row.motorista ?? '',
    obraId: row.obra_id ?? null,
    etapaId: row.etapa_id ?? null,
    alocacoes: row.alocacoes ?? null,
    tipoCombustivel: row.tipo_combustivel,
    litros: Number(row.litros),
    precoMedioTanqueSnapshot: row.preco_medio_tanque_snapshot != null ? Number(row.preco_medio_tanque_snapshot) : null,
    taxaLitro: Number(row.taxa_litro ?? 0),
    precoCombustivel: row.preco_combustivel != null ? Number(row.preco_combustivel) : null,
    precoCombustivelAreacre: row.preco_combustivel_areacre != null ? Number(row.preco_combustivel_areacre) : null,
    precoUnitario: Number(row.preco_unitario),
    valorTotal: Number(row.valor_total),
    fotoUrls: row.foto_urls ?? null,
    arquivoUrls: row.arquivo_urls ?? [],
    observacoes: row.observacoes ?? null,
    pago: row.pago,
    pagoEm: row.pago_em ?? null,
    movimentoId: row.movimento_id ?? null,
    medicaoNoAbastecimento:
      row.medicao_no_abastecimento != null ? Number(row.medicao_no_abastecimento) : null,
    tipoMedicaoSnapshot: row.tipo_medicao_snapshot ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export function saidaCombustivelToDb(s: SaidaCombustivel) {
  return {
    id: s.id,
    data: s.data,
    origem: s.origem,
    tipo_consumidor: s.tipoConsumidor,
    tanque_id: s.tanqueId,
    equipamento_id: s.equipamentoId,
    transportadora_id: s.transportadoraId,
    placa: s.placa,
    motorista: s.motorista,
    obra_id: s.obraId,
    etapa_id: s.etapaId,
    alocacoes: s.alocacoes,
    tipo_combustivel: s.tipoCombustivel,
    litros: s.litros,
    preco_medio_tanque_snapshot: s.precoMedioTanqueSnapshot,
    taxa_litro: s.taxaLitro,
    preco_combustivel: s.precoCombustivel,
    preco_combustivel_areacre: s.precoCombustivelAreacre,
    preco_unitario: s.precoUnitario,
    valor_total: s.valorTotal,
    foto_urls: s.fotoUrls,
    arquivo_urls: s.arquivoUrls ?? [],
    observacoes: s.observacoes,
    pago: s.pago,
    pago_em: s.pagoEm,
    movimento_id: s.movimentoId,
    medicao_no_abastecimento: s.medicaoNoAbastecimento,
    tipo_medicao_snapshot: s.tipoMedicaoSnapshot,
    created_by: s.createdBy,
    updated_by: s.updatedBy,
    // created_at e updated_at: defaults do DB / trigger
  };
}

// ── Transportadora Movimentos ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTransportadoraMovimento(row: any): TransportadoraMovimento {
  return {
    id: row.id,
    transportadoraId: row.transportadora_id,
    data: row.data,
    tipo: row.tipo,
    valor: Number(row.valor),
    origemTabela: row.origem_tabela,
    origemId: row.origem_id,
    descricao: row.descricao ?? null,
    obraId: row.obra_id ?? null,
    mesReferencia: row.mes_referencia ?? null,
    abatidoEmPagamentoId: row.abatido_em_pagamento_id ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
    fretePesoToneladas: row.frete_peso_toneladas != null ? Number(row.frete_peso_toneladas) : null,
    freteKmRodados: row.frete_km_rodados != null ? Number(row.frete_km_rodados) : null,
    freteValorTkm: row.frete_valor_tkm != null ? Number(row.frete_valor_tkm) : null,
    freteOrigem: row.frete_origem ?? null,
    freteDestino: row.frete_destino ?? null,
    freteInsumoId: row.frete_insumo_id ?? null,
    freteNotaFiscal: row.frete_nota_fiscal ?? null,
    freteNotaFiscal2: row.frete_nota_fiscal2 ?? null,
    fretePlacaCarreta: row.frete_placa_carreta ?? null,
    freteMotorista: row.frete_motorista ?? null,
    saidaLitros: row.saida_litros != null ? Number(row.saida_litros) : null,
    saidaPrecoCombustivel: row.saida_preco_combustivel != null ? Number(row.saida_preco_combustivel) : null,
    saidaPrecoCombustivelAreacre: row.saida_preco_combustivel_areacre != null ? Number(row.saida_preco_combustivel_areacre) : null,
    saidaTaxaLitro: row.saida_taxa_litro != null ? Number(row.saida_taxa_litro) : null,
    saidaPrecoMedioTanque: row.saida_preco_medio_tanque != null ? Number(row.saida_preco_medio_tanque) : null,
    saidaTipoCombustivel: row.saida_tipo_combustivel ?? null,
    saidaTipoConsumidor: row.saida_tipo_consumidor ?? null,
    saidaPlaca: row.saida_placa ?? null,
    saidaMotorista: row.saida_motorista ?? null,
    saidaObservacoes: row.saida_observacoes ?? null,
    pagamentoMetodo: row.pagamento_metodo ?? null,
    pagamentoNotaFiscal: row.pagamento_nota_fiscal ?? null,
    pagamentoResponsavel: row.pagamento_responsavel ?? null,
    pagamentoPagoPor: row.pagamento_pago_por ?? null,
    pagamentoObservacoes: row.pagamento_observacoes ?? null,
    pagamentoQuantidadeCombustivel: row.pagamento_quantidade_combustivel != null ? Number(row.pagamento_quantidade_combustivel) : null,
  };
}

export function transportadoraMovimentoToDb(m: TransportadoraMovimento) {
  return {
    id: m.id,
    transportadora_id: m.transportadoraId,
    data: m.data,
    tipo: m.tipo,
    valor: m.valor,
    origem_tabela: m.origemTabela,
    origem_id: m.origemId,
    descricao: m.descricao,
    obra_id: m.obraId,
    mes_referencia: m.mesReferencia,
    abatido_em_pagamento_id: m.abatidoEmPagamentoId,
    created_by: m.createdBy,
    // created_at: default do DB
  };
}

// ── Transportadora Saldos (view, read-only) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToTransportadoraSaldo(row: any): TransportadoraSaldo {
  return {
    transportadoraId: row.transportadora_id,
    nome: row.nome,
    ehDonaDeTanque: row.eh_dona_de_tanque ?? false,
    saldo: Number(row.saldo ?? 0),
    debitoCombustivelTotal: Number(row.debito_combustivel_total ?? 0),
    creditoFreteTotal: Number(row.credito_frete_total ?? 0),
    pagoFreteTotal: Number(row.pago_frete_total ?? 0),
    qtdMovimentos: Number(row.qtd_movimentos ?? 0),
  };
}

// ── Recebimentos de OC (v2.7) ─────────────────────────────────────────
// Itens da remessa ficam no JSONB `itens` da tabela — não tem tabela filha
// porque cada remessa é "imutável" (você não edita item por item; cria
// outra remessa pra corrigir).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToRecebimentoOC(row: any): RecebimentoOC {
  return {
    id: row.id,
    ordemCompraId: row.ordem_compra_id,
    numeroRemessa: Number(row.numero_remessa),
    dataRecebimento: row.data_recebimento,
    notaFiscalEntrega: row.nota_fiscal_entrega ?? '',
    observacoes: row.observacoes ?? '',
    itens: ((row.itens ?? []) as ItemRecebimentoOC[]).map((it) => ({
      id: it.id,
      itemOrdemCompraId: it.itemOrdemCompraId,
      quantidadeRecebida: Number(it.quantidadeRecebida),
      depositoDestinoId: it.depositoDestinoId,
      lote: it.lote,
      validade: it.validade,
      entradaMaterialId: it.entradaMaterialId,
      entradaCombustivelId: it.entradaCombustivelId,
      observacoes: it.observacoes,
    })),
    recebidoPor: row.recebido_por ?? '',
    recebidoEm: row.recebido_em ?? '',
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function recebimentoOCToDb(r: RecebimentoOC) {
  return {
    id: r.id,
    ordem_compra_id: r.ordemCompraId,
    numero_remessa: r.numeroRemessa,
    data_recebimento: r.dataRecebimento,
    nota_fiscal_entrega: r.notaFiscalEntrega ?? '',
    observacoes: r.observacoes ?? '',
    itens: r.itens,
    recebido_por: r.recebidoPor,
    recebido_em: r.recebidoEm,
    atualizado_em: r.atualizadoEm ?? null,
    atualizado_por: r.atualizadoPor ?? null,
    deletado_em: r.deletadoEm ?? null,
    deletado_por: r.deletadoPor ?? null,
  };
}

// ── Financeiro (v1) ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToCategoriaFinanceira(row: any): CategoriaFinanceira {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo ?? 'despesa',
    ordem: Number(row.ordem ?? 0),
    ativo: Boolean(row.ativo),
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em ?? '',
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function categoriaFinanceiraToDb(c: CategoriaFinanceira) {
  return {
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    ordem: c.ordem,
    ativo: c.ativo,
    criado_por: c.criadoPor ?? '',
    criado_em: c.criadoEm ?? '',
    atualizado_em: c.atualizadoEm ?? null,
    atualizado_por: c.atualizadoPor ?? null,
    deletado_em: c.deletadoEm ?? null,
    deletado_por: c.deletadoPor ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToParcelaLancamento(row: any): ParcelaLancamento {
  return {
    id: row.id,
    lancamentoId: row.lancamento_id,
    numero: Number(row.numero),
    dataVencimento: row.data_vencimento,
    valor: Number(row.valor),
    dataPagamento: row.data_pagamento ?? undefined,
    valorPago: row.valor_pago != null ? Number(row.valor_pago) : undefined,
    status: (row.status ?? 'em_aberto') as StatusParcelaLancamento,
  };
}

export function parcelaLancamentoToDb(p: ParcelaLancamento) {
  return {
    id: p.id,
    lancamento_id: p.lancamentoId,
    numero: p.numero,
    data_vencimento: p.dataVencimento,
    valor: p.valor,
    data_pagamento: p.dataPagamento ?? null,
    valor_pago: p.valorPago ?? null,
    status: p.status,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToRateioLancamento(row: any): RateioLancamento {
  return {
    id: row.id,
    lancamentoId: row.lancamento_id,
    tipoDestino: row.tipo_destino as TipoDestinoRateio,
    obraId: row.obra_id ?? undefined,
    etapaObraId: row.etapa_obra_id ?? undefined,
    ordemServicoId: row.ordem_servico_id ?? undefined,
    equipamentoId: row.equipamento_id ?? undefined,
    depositoMaterialId: row.deposito_material_id ?? undefined,
    depositoId: row.deposito_id ?? undefined,
    valor: Number(row.valor),
    percentual: row.percentual != null ? Number(row.percentual) : undefined,
    observacoes: row.observacoes ?? '',
  };
}

export function rateioLancamentoToDb(r: RateioLancamento) {
  return {
    id: r.id,
    lancamento_id: r.lancamentoId,
    tipo_destino: r.tipoDestino,
    obra_id: r.obraId ?? null,
    etapa_obra_id: r.etapaObraId ?? null,
    ordem_servico_id: r.ordemServicoId ?? null,
    equipamento_id: r.equipamentoId ?? null,
    deposito_material_id: r.depositoMaterialId ?? null,
    deposito_id: r.depositoId ?? null,
    valor: r.valor,
    percentual: r.percentual ?? null,
    observacoes: r.observacoes ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToPagamentoLancamento(row: any): PagamentoLancamento {
  return {
    id: row.id,
    parcelaId: row.parcela_id,
    dataPagamento: row.data_pagamento,
    valor: Number(row.valor),
    formaPagamento: row.forma_pagamento ?? '',
    comprovanteUrl: row.comprovante_url ?? undefined,
    observacoes: row.observacoes ?? '',
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em ?? '',
  };
}

export function pagamentoLancamentoToDb(p: PagamentoLancamento) {
  return {
    id: p.id,
    parcela_id: p.parcelaId,
    data_pagamento: p.dataPagamento,
    valor: p.valor,
    forma_pagamento: p.formaPagamento ?? '',
    comprovante_url: p.comprovanteUrl ?? null,
    observacoes: p.observacoes ?? '',
    criado_por: p.criadoPor ?? '',
    criado_em: p.criadoEm ?? '',
  };
}

/** Header do lançamento (sem parcelas/rateios — esses vêm em queries separadas). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbToLancamentoFinanceiro(row: any): LancamentoFinanceiro {
  return {
    id: row.id,
    numero: row.numero,
    origem: (row.origem ?? 'avulso') as OrigemLancamento,
    ordemCompraId: row.ordem_compra_id ?? undefined,
    dataEmissao: row.data_emissao,
    dataVencimento: row.data_vencimento,
    fornecedorId: row.fornecedor_id ?? undefined,
    favorecidoNome: row.favorecido_nome ?? '',
    empresaPagadoraId: row.empresa_pagadora_id ?? undefined,
    categoriaId: row.categoria_id ?? undefined,
    descricao: row.descricao ?? '',
    valorTotal: Number(row.valor_total ?? 0),
    formaPagamento: row.forma_pagamento ?? '',
    observacoes: row.observacoes ?? '',
    anexosUrls: (row.anexos_urls ?? []) as string[],
    status: (row.status ?? 'em_aberto') as StatusLancamento,
    fechado: Boolean(row.fechado),
    fechadoEm: row.fechado_em ?? undefined,
    fechadoPor: row.fechado_por ?? undefined,
    reabertoEm: row.reaberto_em ?? undefined,
    reabertoPor: row.reaberto_por ?? undefined,
    parcelas: [], // preenchido pelo hook que faz o join
    rateios: [],  // idem
    criadoPor: row.criado_por ?? '',
    criadoEm: row.criado_em ?? '',
    atualizadoEm: row.atualizado_em ?? undefined,
    atualizadoPor: row.atualizado_por ?? undefined,
    deletadoEm: row.deletado_em ?? undefined,
    deletadoPor: row.deletado_por ?? undefined,
  };
}

export function lancamentoFinanceiroToDb(l: LancamentoFinanceiro) {
  return {
    id: l.id,
    numero: l.numero,
    origem: l.origem,
    ordem_compra_id: l.ordemCompraId ?? null,
    data_emissao: l.dataEmissao,
    data_vencimento: l.dataVencimento,
    fornecedor_id: l.fornecedorId ?? null,
    favorecido_nome: l.favorecidoNome ?? '',
    empresa_pagadora_id: l.empresaPagadoraId ?? null,
    categoria_id: l.categoriaId ?? null,
    descricao: l.descricao,
    valor_total: l.valorTotal,
    forma_pagamento: l.formaPagamento ?? '',
    observacoes: l.observacoes ?? '',
    anexos_urls: l.anexosUrls ?? [],
    status: l.status,
    fechado: l.fechado ?? false,
    fechado_em: l.fechadoEm ?? null,
    fechado_por: l.fechadoPor ?? null,
    reaberto_em: l.reabertoEm ?? null,
    reaberto_por: l.reabertoPor ?? null,
    criado_por: l.criadoPor ?? '',
    criado_em: l.criadoEm ?? '',
    atualizado_em: l.atualizadoEm ?? null,
    atualizado_por: l.atualizadoPor ?? null,
    deletado_em: l.deletadoEm ?? null,
    deletado_por: l.deletadoPor ?? null,
  };
}
