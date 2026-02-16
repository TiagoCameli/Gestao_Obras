/**
 * Migracao de dados do localStorage para Supabase.
 *
 * Ordem de insercao (respeita foreign keys):
 *  1. unidades_medida, insumos, fornecedores, equipamentos
 *  2. obras
 *  3. etapas_obra, depositos, depositos_material
 *  4. funcionarios (+ criar usuario Auth) + perfis_permissao
 *  5. entradas_combustivel, abastecimentos, transferencias_combustivel
 *  6. entradas_material, saidas_material, transferencias_material
 *  7. audit_log
 */

import { supabase } from '../lib/supabase';
import {
  obraToDb,
  etapaToDb,
  depositoToDb,
  abastecimentoToDb,
  entradaCombustivelToDb,
  equipamentoToDb,
  insumoToDb,
  transferenciaCombustivelToDb,
  fornecedorToDb,
  depositoMaterialToDb,
  unidadeMedidaToDb,
  entradaMaterialToDb,
  saidaMaterialToDb,
  transferenciaMaterialToDb,
  funcionarioToDb,
  perfilPermissaoToDb,
} from '../lib/mappers';
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
  Funcionario,
  PerfilPermissao,
  AuditLogEntry,
} from '../types';

const KEYS = {
  obras: 'gestao_obras_obras',
  etapas: 'gestao_obras_etapas',
  depositos: 'gestao_obras_depositos',
  abastecimentos: 'gestao_obras_abastecimentos',
  entradas: 'gestao_obras_entradas',
  equipamentos: 'gestao_obras_equipamentos',
  insumos: 'gestao_obras_insumos',
  transferencias: 'gestao_obras_transferencias',
  fornecedores: 'gestao_obras_fornecedores',
  unidades: 'gestao_obras_unidades',
  depositosMaterial: 'gestao_obras_depositos_material',
  entradasMaterial: 'gestao_obras_entradas_material',
  saidasMaterial: 'gestao_obras_saidas_material',
  transferenciasMaterial: 'gestao_obras_transferencias_material',
  funcionarios: 'gestao_obras_funcionarios',
  permissoes: 'gestao_obras_permissoes',
  auditLog: 'gestao_obras_audit_log',
};

function readLS<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

async function upsertBatch<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  log: (msg: string) => void,
): Promise<void> {
  if (rows.length === 0) {
    log(`  ${table}: 0 registros — pulando`);
    return;
  }
  // Supabase accepts max ~1000 rows per insert, chunk if needed
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += chunk.length;
  }
  log(`  ${table}: ${inserted} registros migrados`);
}

export interface MigrationProgress {
  step: string;
  done: boolean;
  error?: string;
}

export async function migrarParaSupabase(
  onProgress: (p: MigrationProgress) => void,
  senhasPadrao: string = 'Admin@123',
): Promise<void> {
  const log = (msg: string) => onProgress({ step: msg, done: false });

  try {
    // --- 1. Unidades, Insumos, Fornecedores, Equipamentos ---
    log('Migrando unidades de medida...');
    const unidades = readLS<UnidadeMedida>(KEYS.unidades);
    await upsertBatch('unidades_medida', unidades.map(unidadeMedidaToDb), log);

    log('Migrando insumos...');
    const insumos = readLS<Insumo>(KEYS.insumos);
    await upsertBatch('insumos', insumos.map(insumoToDb), log);

    log('Migrando fornecedores...');
    const fornecedores = readLS<Fornecedor>(KEYS.fornecedores);
    await upsertBatch('fornecedores', fornecedores.map(fornecedorToDb), log);

    log('Migrando equipamentos...');
    const equipamentos = readLS<Equipamento>(KEYS.equipamentos);
    await upsertBatch('equipamentos', equipamentos.map(equipamentoToDb), log);

    // --- 2. Obras ---
    log('Migrando obras...');
    const obras = readLS<Obra>(KEYS.obras);
    await upsertBatch('obras', obras.map(obraToDb), log);

    // --- 3. Etapas, Depositos, DepositosMaterial ---
    log('Migrando etapas...');
    const etapas = readLS<EtapaObra>(KEYS.etapas);
    await upsertBatch('etapas_obra', etapas.map(etapaToDb), log);

    log('Migrando depositos (combustivel)...');
    const depositos = readLS<Deposito>(KEYS.depositos);
    await upsertBatch('depositos', depositos.map(depositoToDb), log);

    log('Migrando depositos de material...');
    const depositosMaterial = readLS<DepositoMaterial>(KEYS.depositosMaterial);
    await upsertBatch('depositos_material', depositosMaterial.map(depositoMaterialToDb), log);

    // --- 4. Funcionarios + Auth + Permissoes ---
    log('Migrando funcionarios...');
    const funcionarios = readLS<Funcionario>(KEYS.funcionarios);
    for (const func of funcionarios) {
      // Create Supabase Auth user via Edge Function
      log(`  Criando usuario Auth: ${func.email}...`);
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('create-user', {
          body: { email: func.email, password: senhasPadrao },
        });

        const authUserId = fnError ? undefined : fnData?.userId;

        // Insert funcionario with auth_user_id
        const dbRow = funcionarioToDb({ ...func, authUserId });
        const { error: insertError } = await supabase
          .from('funcionarios')
          .upsert(dbRow, { onConflict: 'id' });
        if (insertError) throw new Error(`funcionarios: ${insertError.message}`);
      } catch (err) {
        // If user already exists in Auth, try to continue
        const msg = (err as Error).message;
        if (msg.includes('already been registered') || msg.includes('already exists')) {
          log(`  Usuario ${func.email} ja existe no Auth — inserindo somente na tabela...`);
          const dbRow = funcionarioToDb(func);
          const { error: insertError } = await supabase
            .from('funcionarios')
            .upsert(dbRow, { onConflict: 'id' });
          if (insertError) throw new Error(`funcionarios: ${insertError.message}`);
        } else {
          throw err;
        }
      }
    }
    log(`  funcionarios: ${funcionarios.length} registros migrados`);

    log('Migrando perfis de permissao...');
    const permissoes = readLS<PerfilPermissao>(KEYS.permissoes);
    await upsertBatch('perfis_permissao', permissoes.map(perfilPermissaoToDb), log);

    // --- 5. Movimentacoes Combustivel ---
    log('Migrando entradas de combustivel...');
    const entradasComb = readLS<EntradaCombustivel>(KEYS.entradas);
    await upsertBatch('entradas_combustivel', entradasComb.map(entradaCombustivelToDb), log);

    log('Migrando abastecimentos...');
    const abastecimentos = readLS<Abastecimento>(KEYS.abastecimentos);
    await upsertBatch('abastecimentos', abastecimentos.map(abastecimentoToDb), log);

    log('Migrando transferencias de combustivel...');
    const transfComb = readLS<TransferenciaCombustivel>(KEYS.transferencias);
    await upsertBatch('transferencias_combustivel', transfComb.map(transferenciaCombustivelToDb), log);

    // --- 6. Movimentacoes Material ---
    log('Migrando entradas de material...');
    const entradasMat = readLS<EntradaMaterial>(KEYS.entradasMaterial);
    await upsertBatch('entradas_material', entradasMat.map(entradaMaterialToDb), log);

    log('Migrando saidas de material...');
    const saidasMat = readLS<SaidaMaterial>(KEYS.saidasMaterial);
    await upsertBatch('saidas_material', saidasMat.map(saidaMaterialToDb), log);

    log('Migrando transferencias de material...');
    const transfMat = readLS<TransferenciaMaterial>(KEYS.transferenciasMaterial);
    await upsertBatch('transferencias_material', transfMat.map(transferenciaMaterialToDb), log);

    // --- 7. Audit Log ---
    log('Migrando audit log...');
    const auditLog = readLS<AuditLogEntry>(KEYS.auditLog);
    if (auditLog.length > 0) {
      const rows = auditLog.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        funcionario_id: a.funcionarioId,
        alvo_id: a.alvoId,
        detalhes: a.detalhes,
        data_hora: a.dataHora,
      }));
      await upsertBatch('audit_log', rows, log);
    } else {
      log('  audit_log: 0 registros — pulando');
    }

    onProgress({ step: 'Migracao concluida com sucesso!', done: true });
  } catch (err) {
    onProgress({ step: (err as Error).message, done: true, error: (err as Error).message });
    throw err;
  }
}
