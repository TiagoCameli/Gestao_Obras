export type ServiceType =
  | "Correção de Defeito (CBUQ)"
  | "Remendo Profundo"
  | "Troca de Solo"
  | "Paliativo"
  | "Drenagem / Dreno"
  | "Sinalização"
  | "Sinalização Vertical"
  | "Roçada"
  | "Limpeza de Dispositivos"
  | "Tapa-Buraco"
  | "Outros";

export const SERVICE_TYPES: ServiceType[] = [
  "Correção de Defeito (CBUQ)",
  "Remendo Profundo",
  "Troca de Solo",
  "Paliativo",
  "Drenagem / Dreno",
  "Sinalização",
  "Sinalização Vertical",
  "Roçada",
  "Limpeza de Dispositivos",
  "Tapa-Buraco",
  "Outros",
];

export interface Quantity {
  id: string;
  name: string;
  value: string;
}

export type LadoPista = "Direito" | "Esquerdo" | "Pista Toda";

export const LADO_PISTA_OPTIONS: LadoPista[] = ["Direito", "Esquerdo", "Pista Toda"];

export interface AreaRect {
  corners: [number, number][]; // 4 pairs of [lat, lng]
  totalLabelPos?: [number, number]; // optional draggable override for total-area label
}

export const SERVICES_WITH_AREA: ServiceType[] = ["Troca de Solo", "Remendo Profundo"];

/** Serviços cujo ponto real é uma **rota linear** (início + fim) em vez de pin. */
export const SERVICES_WITH_SEGMENT: ServiceType[] = ["Correção de Defeito (CBUQ)"];

export function isSegmentService(service: ServiceType): boolean {
  return SERVICES_WITH_SEGMENT.includes(service);
}

export interface PhotoFolder {
  id: string;
  name: string;
  photoIds: string[];
  /** Subpastas — permitem hierarquia de fotos (ex: import de pasta com subpastas). */
  subfolders?: PhotoFolder[];
}

export interface PdfFile {
  id: string;
  name: string;
  size: number;
}

export type PlanStatus = "todo" | "in_progress" | "done" | "blocked";

export const PLAN_STATUS_OPTIONS: { value: PlanStatus; label: string; color: string }[] = [
  { value: "todo", label: "A fazer", color: "#6b7488" },
  { value: "in_progress", label: "Em andamento", color: "#5aa7ff" },
  { value: "done", label: "Concluído", color: "#2fd3a6" },
  { value: "blocked", label: "Bloqueado", color: "#ff5a72" },
];

export interface PlanItem {
  id: string;
  obraId: string;
  name: string;
  service?: ServiceType;
  startDate: string;    // ISO date YYYY-MM-DD
  endDate: string;      // ISO date YYYY-MM-DD
  progress: number;     // 0..100
  status: PlanStatus;
  notes?: string;
  color?: string;       // optional override
  createdAt: number;
  updatedAt: number;
}

/** Contract / BOQ line item associated with an obra */
export interface ContractItem {
  id: string;
  obraId: string;
  code?: string;          // identifier (e.g. "2.1.3") — not used for aggregation
  name: string;
  unit: string;           // e.g. "m²", "t", "m³"
  contractedQty: number;
  unitPrice: number;      // in BRL
  /** Quantity measured in the current measurement period. Leaves only. */
  currentQty?: number;
  /** Accumulated quantity measured across all periods. Leaves only. */
  measuredQty?: number;
  /**
   * Explicit role for the row — authoritative.
   *  - "etapa":     top-level aggregator, sums its code-children.
   *  - "subetapa":  mid-level aggregator, sums its code-children.
   *  - "item":      carries its own contractedQty × unitPrice (never aggregates).
   * When unset, legacy rows fall back to code-depth inference.
   */
  type?: "etapa" | "subetapa" | "item";
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Cargas de CBUQ (tickets de pesagem) associadas a uma atividade de
 * Correção de Defeito (CBUQ). Peso e placa são obrigatórios; data e hora
 * opcionais.
 */
export interface CbuqCarga {
  id: string;
  data?: string;     // ISO YYYY-MM-DD
  placa: string;
  hora?: string;     // HH:mm
  pesoT: number;     // peso líquido em toneladas
}

/**
 * Dados específicos de atividades de Correção de Defeito (CBUQ) — cada
 * atividade acumula as cargas que chegam em campo e gera automaticamente
 * os quantitativos do contrato (códigos 04.xx).
 */
export interface CbuqData {
  /** Medição em que as cargas serão lançadas. */
  medicaoNumber: number;
  cargas: CbuqCarga[];
  /** Quantidades computadas — {código do contrato → qtd}. */
  contributions: Record<string, number>;
}

/**
 * Data specific to Troca de Solo activities — feeds the automatic
 * calculation that pushes quantities into the contract's current medição.
 */
export interface TrocaSoloData {
  /** Categoria contratual — define se os códigos pertencem ao bloco 02.xx ou 03.xx */
  categoria: "passivo" | "rotineira";
  /** Número da medição em que esta atividade foi registrada (ciclo). */
  medicaoNumber: number;
  /** Medidas físicas do trecho trocado (em metros). */
  comprimento: number;
  largura: number;
  espessura: number;
  /** Drenos associados ao trecho (podem ser zero, um ou vários). */
  drenos: { comprimento: number; largura: number; espessura: number }[];
  /** Quantidades geradas pelas fórmulas — {codigo do contrato → qtd}. */
  contributions: Record<string, number>;
}

/** Dados da atividade Sinalização Vertical: linhas avulsas de quantitativos
 *  por item de contrato. As contributions seguem o mesmo formato usado por
 *  cbuq/trocaSolo (code → qty) e entram na agregação da medição. */
export interface SinalizacaoVerticalData {
  medicaoNumber: number;
  /** Quantidades manuais por item de contrato — {codigo → qtd}. */
  contributions: Record<string, number>;
}

export interface Activity {
  id: string;
  lat: number;
  lng: number;
  /** Para serviços tipo CBUQ (linhas seguindo a rodovia), coord do ponto final. */
  latEnd?: number;
  lngEnd?: number;
  service: ServiceType;
  serviceName?: string;
  trocaSolo?: TrocaSoloData;
  cbuq?: CbuqData;
  sinalizacaoVertical?: SinalizacaoVerticalData;
  /** Para serviços com período, esta é a data inicial. */
  date: string;
  /** Data final — usada apenas para atividades com intervalo (CBUQ). */
  dateEnd?: string;
  medicao: number | null;
  /** Para CBUQ: km inicial. Para atividades pontuais: km único. */
  km: string;
  /** Km final — usado apenas para atividades com intervalo (CBUQ). */
  kmEnd?: string;
  lado: LadoPista;
  areaRect: AreaRect | null;
  description: string;
  quantities: Quantity[];
  photoIds: string[];           // kept for backward compat
  photoFolders: PhotoFolder[];  // new: named folders
  pdfs?: PdfFile[];             // document attachments (binaries in IndexedDB)
  createdAt: number;
  updatedAt: number;
}

/** Coleta IDs recursivamente de uma pasta e suas subpastas. */
export function collectPhotoIds(folder: PhotoFolder): string[] {
  const ids = [...(folder.photoIds ?? [])];
  for (const sub of folder.subfolders ?? []) {
    ids.push(...collectPhotoIds(sub));
  }
  return ids;
}

/** Get all photo IDs across folders + legacy flat list */
export function getAllPhotoIds(activity: Activity): string[] {
  const fromFolders = (activity.photoFolders ?? []).flatMap(collectPhotoIds);
  const legacy = activity.photoIds ?? [];
  return [...new Set([...fromFolders, ...legacy])];
}

/** Total photo count */
export function getTotalPhotoCount(activity: Activity): number {
  return getAllPhotoIds(activity).length;
}

export interface Filters {
  dateStart: string;
  dateEnd: string;
  service: ServiceType | "";
  medicao: number | null;
  kmStart: string;
  kmEnd: string;
}

export type TipoObra =
  | "Manutenção de Rodovia"
  | "Reconstrução de Rodovia"
  | "Duplicação de Rodovia"
  | "Implantação de Rodovia"
  | "Restauração de Rodovia"
  | "Conservação Rotineira"
  | "Conservação Periódica"
  | "Pavimentação"
  | "Terraplenagem"
  | "Obra de Arte Especial (Ponte/Viaduto)"
  | "Drenagem e OAC"
  | "Sinalização Viária"
  | "Outro";

export const TIPO_OBRA_OPTIONS: TipoObra[] = [
  "Manutenção de Rodovia",
  "Reconstrução de Rodovia",
  "Duplicação de Rodovia",
  "Implantação de Rodovia",
  "Restauração de Rodovia",
  "Conservação Rotineira",
  "Conservação Periódica",
  "Pavimentação",
  "Terraplenagem",
  "Obra de Arte Especial (Ponte/Viaduto)",
  "Drenagem e OAC",
  "Sinalização Viária",
  "Outro",
];

/** Tipos que exigem KM inicial/final */
export const TIPOS_COM_KM: TipoObra[] = [
  "Manutenção de Rodovia",
  "Reconstrução de Rodovia",
];

export interface Obra {
  id: string;
  name: string;
  tipoObra: TipoObra;
  rodovia: string;
  lote: string;
  trecho: string;
  contrato: string;
  kmInicial: number | null;
  kmFinal: number | null;
  centerLat: number;
  centerLng: number;
  zoom: number;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  routeGeoJson: [number, number][] | null;
  extensionKm: number | null;
  createdAt: number;
  updatedAt: number;
}
