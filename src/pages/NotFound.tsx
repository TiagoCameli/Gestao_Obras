import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="text-gray-500 mt-4 mb-8">Pagina nao encontrada</p>
      <Link
        to="/"
        className="bg-emt-verde text-white px-6 py-2 rounded-lg hover:bg-emt-verde-escuro transition-colors"
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
