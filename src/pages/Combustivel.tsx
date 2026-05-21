import { Link } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import FrotaCombustivelContainer from '../components/frota/combustivel/FrotaCombustivelContainer';

export default function Combustivel() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">
          Combustível
        </h1>
        <Link
          to="/m/scan"
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:opacity-90 transition-opacity self-start sm:self-auto"
          title="Abrir scanner de QR (requer câmera)"
        >
          <ScanLine aria-hidden className="w-4 h-4" />
          Escanear QR
        </Link>
      </div>
      <FrotaCombustivelContainer />
    </div>
  );
}
