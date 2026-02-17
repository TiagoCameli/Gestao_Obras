import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-emt-cinza-claro flex flex-col">
      <Header />
      <main className="max-w-[1600px] mx-auto px-4 py-8 flex-1 w-full">
        <Outlet />
      </main>
      <footer className="bg-emt-cinza text-white/60 text-center text-xs py-3">
        © 2026 EMT Construtora
      </footer>
    </div>
  );
}
