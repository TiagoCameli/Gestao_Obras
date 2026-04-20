import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-app flex flex-col">
      <Header />
      <main className="max-w-[1920px] mx-auto px-3 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        <Outlet />
      </main>
      <footer className="border-t border-token text-fg-subtle text-center text-xs py-4">
        © 2026 EMT Construtora
      </footer>
    </div>
  );
}
