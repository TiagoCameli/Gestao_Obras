// Agregação pura pra tabela "Horas por funcionário" da DashboardTab RH.
// Recebe apontamentos do período + maps de lookup, retorna 1 linha por
// funcionário com horas produtivas + detalhes (obra, serviço, horas, %).

import type { Funcionario, Obra } from '../types/funcionario'
import type { Servico, ApontamentoServico } from './apontamentoServicoApi'

export interface DetalheServico {
  obraId: string | null
  obraNome: string
  servicoId: string | null
  servicoCodigo: string | null
  servicoNome: string
  horas: number
  percentual: number
}

export interface LinhaFunc {
  funcionarioId: string
  funcionarioNome: string
  horasProd: number
  obrasCount: number
  servicosCount: number
  detalhes: DetalheServico[]
}

export function agregarHorasPorFuncionario(
  apontamentos: ApontamentoServico[],
  funcsById: Map<string, Funcionario>,
  servicosById: Map<string, Servico>,
  obrasById: Map<string, Obra>,
): LinhaFunc[] {
  // 1) filtra só produtivos
  const produtivos = apontamentos.filter((a) => a.tipo === 'produtivo')

  // 2) agrupa por (funcionarioId, servicoId) somando horas
  type Key = string
  const bucket = new Map<Key, { funcId: string; servicoId: string | null; horas: number }>()
  for (const a of produtivos) {
    const key = `${a.funcionarioId}|${a.servicoId ?? 'null'}`
    const prev = bucket.get(key)
    if (prev) prev.horas += a.horas
    else bucket.set(key, { funcId: a.funcionarioId, servicoId: a.servicoId, horas: a.horas })
  }

  // 3) reagrupa por funcionário
  const porFunc = new Map<string, LinhaFunc>()
  for (const item of bucket.values()) {
    const func = funcsById.get(item.funcId)
    if (!func) continue // funcionário deletado/órfão — descarta
    let linha = porFunc.get(item.funcId)
    if (!linha) {
      linha = {
        funcionarioId: item.funcId,
        funcionarioNome: func.nome,
        horasProd: 0,
        obrasCount: 0,
        servicosCount: 0,
        detalhes: [],
      }
      porFunc.set(item.funcId, linha)
    }
    const servico = item.servicoId ? servicosById.get(item.servicoId) : null
    const obraId = servico?.obraId ?? null
    const obraNome = obraId
      ? (obrasById.get(obraId)?.nome ?? `Obra ${obraId}`)
      : '—'
    linha.detalhes.push({
      obraId,
      obraNome,
      servicoId: item.servicoId,
      servicoCodigo: servico?.codigo ?? null,
      servicoNome: servico?.nome ?? '— Sem serviço vinculado —',
      horas: item.horas,
      percentual: 0, // calculado em (4)
    })
    linha.horasProd += item.horas
  }

  // 4) calcula percentual + counts + sort detalhes por horas desc
  for (const linha of porFunc.values()) {
    linha.obrasCount = new Set(
      linha.detalhes.map((d) => d.obraId).filter((id): id is string => id !== null),
    ).size
    linha.servicosCount = new Set(
      linha.detalhes.map((d) => d.servicoId).filter((id): id is string => id !== null),
    ).size
    linha.detalhes.sort((a, b) => b.horas - a.horas)
    for (const d of linha.detalhes) {
      d.percentual = linha.horasProd > 0 ? (d.horas / linha.horasProd) * 100 : 0
    }
  }

  // 5) só funcionários com horas > 0
  return Array.from(porFunc.values()).filter((l) => l.horasProd > 0)
}
