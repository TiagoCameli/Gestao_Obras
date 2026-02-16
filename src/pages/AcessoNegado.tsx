import { Link } from 'react-router-dom';

export default function AcessoNegado() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="text-6xl font-bold text-red-300 mb-4">403</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
      <p className="text-gray-500 mb-6">
        Voce nao tem permissao para acessar esta pagina.
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
      >
        Voltar ao Inicio
      </Link>
    </div>
  );
}
