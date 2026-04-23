import { Outlet } from 'react-router-dom';
import Header from './Header';

/**
 * Layout alternativo pras páginas que precisam usar 100% da área abaixo do
 * cabeçalho do Gestao_Obras — sem padding em volta nem footer. Usado pelo
 * módulo RodoTracker, que tem sua própria sidebar/mapa e espera ocupar a
 * tela inteira.
 */
export default function FullscreenLayout() {
  return (
    <div className="h-dvh flex flex-col bg-app overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
