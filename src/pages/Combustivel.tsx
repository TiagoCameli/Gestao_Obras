import FrotaCombustivelContainer from '../components/frota/combustivel/FrotaCombustivelContainer';
import MobileScanShortcut from '../components/MobileScanShortcut';
import PageHeader from '../components/ui/PageHeader';

export default function Combustivel() {
  return (
    <div className="space-y-6">
      <MobileScanShortcut />
      <PageHeader title="Combustível" />
      <FrotaCombustivelContainer />
    </div>
  );
}
