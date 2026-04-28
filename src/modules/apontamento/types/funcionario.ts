export type TipoVinculo = "CLT" | "diarista" | "terceirizado" | "MEI";

export type StatusFuncionario =
  | "ativo"
  | "inativo"
  | "afastado"
  | "demitido";

export type FuncaoFuncionario =
  | "encarregado"
  | "operador"
  | "motorista"
  | "pedreiro"
  | "servente"
  | "topografo"
  | "engenheiro"
  | "mestre-de-obras"
  | "apontador"
  | "outros";

export const FUNCOES: FuncaoFuncionario[] = [
  "encarregado",
  "operador",
  "motorista",
  "pedreiro",
  "servente",
  "topografo",
  "engenheiro",
  "mestre-de-obras",
  "apontador",
  "outros",
];

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
  obraId: string;
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

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
