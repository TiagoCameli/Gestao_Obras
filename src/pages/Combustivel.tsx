import FrotaCombustivelContainer from '../components/frota/combustivel/FrotaCombustivelContainer';
import MobileScanShortcut from '../components/MobileScanShortcut';
import PageHeader from '../components/ui/PageHeader';
import { AvisoMigradoErp } from '../components/shadcn/aviso-migrado-erp';

export default function Combustivel() {
  return (
    <div className="space-y-6">
      <AvisoMigradoErp modulo="Combustível" caminho="/combustivel" />
      <MobileScanShortcut />
      <PageHeader title="Combustível" />
      <FrotaCombustivelContainer />
    </div>
  );
}
