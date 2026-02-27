export function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function hojeStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function agoraStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function calcHoras(inicio: string, fim: string): number {
  if (!inicio || !fim) return 0;
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const diff = (hf * 60 + mf) - (hi * 60 + mi);
  return Math.max(0, +(diff / 60).toFixed(2));
}

export function formatHoras(h: number): string {
  if (!h) return '-';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}h${mins > 0 ? ` ${mins}min` : ''}`;
}

export function inicioMes(dateStr: string): string {
  return dateStr.substring(0, 7) + '-01';
}

export function fimMes(dateStr: string): string {
  const [y, m] = dateStr.substring(0, 7).split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${dateStr.substring(0, 7)}-${String(last).padStart(2, '0')}`;
}

export function formatDateBR(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function diasUteisPeriodo(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  const d = new Date(inicio + 'T00:00:00');
  const end = new Date(fim + 'T00:00:00');
  while (d <= end) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 6) {
      dias.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatTelefone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const STATUS_AUSENCIA_LABELS: Record<string, string> = {
  falta: 'Falta',
  licenca_medica: 'Licença Médica',
  ferias: 'Férias',
  manutencao: 'Em Manutenção',
  ocioso: 'Ocioso',
};

export type Tab = 'painel' | 'equipamentos' | 'colaboradores' | 'diaristas';

export const tabs: { key: Tab; label: string }[] = [
  { key: 'painel', label: 'Painel' },
  { key: 'equipamentos', label: 'Equipamentos' },
  { key: 'colaboradores', label: 'Colaboradores' },
  { key: 'diaristas', label: 'Diaristas' },
];
