import FrotaCombustivelContainer from '../components/frota/combustivel/FrotaCombustivelContainer';
import MobileScanShortcut from '../components/MobileScanShortcut';

export default function Combustivel() {
  return (
    <div className="space-y-6">
      <MobileScanShortcut />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">
          Combustível
        </h1>
      </div>
      <FrotaCombustivelContainer />
    </div>
  );
}
