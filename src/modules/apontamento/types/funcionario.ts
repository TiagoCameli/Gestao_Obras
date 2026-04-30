export type TipoVinculo = "CLT" | "diarista" | "terceirizado" | "MEI";

export type StatusFuncionario =
  | "ativo"
  | "inativo"
  | "afastado"
  | "demitido";

/** Texto livre — usamos uma lista canônica padronizada (FUNCOES), mas
 *  legados podem trazer valores antigos no banco. */
export type FuncaoFuncionario = string;

/** Lista canônica de funções (alfabética, sem abreviações, tudo maiúsculo). */
export const FUNCOES: FuncaoFuncionario[] = [
  "ADMINISTRADOR DE CARTEIRA DE OBRAS",
  "APONTADOR",
  "AUXILIAR DE COZINHA",
  "AUXILIAR DE ESCRITÓRIO",
  "CONTRAMESTRE",
  "COZINHEIRA",
  "ENCARREGADO",
  "ENGENHEIRO",
  "LABORATORISTA",
  "LOCAÇÃO DE CAMINHÕES",
  "MESTRE DE OBRAS",
  "MOTORISTA",
  "MOTORISTA DE CAMINHÃO",
  "MOTORISTA DE CARRETA",
  "OPERADOR",
  "OPERADOR DE ESCAVADEIRA",
  "OPERADOR DE ESPARGIDOR",
  "OPERADOR DE PÁ ESCAVADEIRA",
  "PARE E SIGA",
  "PEDREIRO",
  "RASTELEIRO",
  "SERVENTE DE OBRAS",
  "TOPÓGRAFO",
  "OUTROS",
];

export interface FuncionarioDocumento {
  id: string;
  nome: string;        // nome original do arquivo
  path: string;        // path no storage
  size: number;        // bytes
  mimeType: string;
  uploadedAt: string;  // ISO timestamp
}

export interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  rg?: string | null;
  pis?: string | null;
  ctps?: string | null;
  dataNascimento: string; // YYYY-MM-DD
  fotoPerfil?: string | null; // path no storage
  fotosReferenciaFacial: string[]; // 1..5 paths
  funcao: FuncaoFuncionario;
  tipoVinculo: TipoVinculo;
  salarioBase?: number | null;
  valorDiaria?: number | null;
  valorHora?: number | null;
  obraId?: string | null;
  equipeId?: string | null;
  encarregadoId?: string | null;
  dataAdmissao: string;
  dataDemissao?: string | null;
  status: StatusFuncionario;
  contatoEmergencia?: string | null;
  permiteHorasExtras: boolean;
  /** Documentos anexados (RG, CTPS, comprovantes, etc.). Aceita qualquer extensão. */
  documentos?: FuncionarioDocumento[];
  createdAt: string;
  updatedAt: string;
}

/** Obra vem do módulo Medição (rodotracker_obras). */
export interface Obra {
  id: string;
  nome: string;
  lote?: string | null;
  rodovia?: string | null;
}

export interface Equipe {
  id: string;
  nome: string;
  /** Obras servidas pela equipe (M:N via apont_equipe_obras). */
  obraIds: string[];
  /** Compat: obra "principal" — primeira de obraIds, ou null se equipe sem obra. */
  obraId: string | null;
  encarregadoId?: string | null;
  ativo: boolean;
}

/**
 * Valor-hora = salário base ÷ 220 para todos os tipos de vínculo.
 */
export function calcularValorHora(
  _tipo: TipoVinculo,
  salarioBase?: number | null
): number | null {
  if (salarioBase && salarioBase > 0) {
    return +(salarioBase / 220).toFixed(4);
  }
  return null;
}

/** Valida CPF brasileiro (11 dígitos + dígito verificador). */
export function isCpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(d[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

export function formatarCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
