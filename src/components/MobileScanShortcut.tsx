// Atalho mobile-only para a página /m (que tem o scanner de QR).
// Visível apenas em viewports < md (Tailwind md:hidden).
// Inserido no topo das páginas administrativas dos módulos de Frota,
// Manutenção e Combustível para operadores que abrem o app no celular.

import { Link } from 'react-router-dom';
import { QrCode } from 'lucide-react';

export default function MobileScanShortcut() {
  return (
    <Link
      to="/m"
      className="md:hidden flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] font-semibold text-base shadow-sm hover:opacity-90 active:scale-[0.98] transition-all"
    >
      <QrCode className="w-5 h-5" />
      Escanear QR do equipamento
    </Link>
  );
}
