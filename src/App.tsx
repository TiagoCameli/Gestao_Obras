import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Obras from './pages/Obras';
import Combustivel from './pages/Combustivel';
import Insumos from './pages/Insumos';
import Frete from './pages/Frete';
import Compras from './pages/Compras';
import Funcionarios from './pages/Funcionarios';
import Login from './pages/Login';
import AcessoNegado from './pages/AcessoNegado';
import NotFound from './pages/NotFound';
import MigrarDados from './pages/MigrarDados';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

const PAGINAS_FALLBACK: { acao: string; rota: string }[] = [
  { acao: 'ver_cadastros', rota: '/obras' },
  { acao: 'ver_combustivel', rota: '/combustivel' },
  { acao: 'ver_insumos', rota: '/insumos' },
  { acao: 'ver_frete', rota: '/frete' },
  { acao: 'ver_compras', rota: '/compras' },
  { acao: 'ver_funcionarios', rota: '/funcionarios' },
];

function HomeRedirect() {
  const { temAcao } = useAuth();

  if (temAcao('ver_dashboard')) {
    return <Dashboard />;
  }

  for (const pg of PAGINAS_FALLBACK) {
    if (temAcao(pg.acao)) {
      return <Navigate to={pg.rota} replace />;
    }
  }

  return <Navigate to="/acesso-negado" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/obras" element={<ProtectedRoute modulo="cadastros"><Obras /></ProtectedRoute>} />
              <Route path="/combustivel" element={<ProtectedRoute modulo="combustivel"><Combustivel /></ProtectedRoute>} />
              <Route path="/insumos" element={<ProtectedRoute modulo="insumos"><Insumos /></ProtectedRoute>} />
              <Route path="/frete" element={<ProtectedRoute modulo="frete"><Frete /></ProtectedRoute>} />
              <Route path="/compras" element={<ProtectedRoute modulo="compras"><Compras /></ProtectedRoute>} />
              <Route path="/funcionarios" element={<ProtectedRoute modulo="funcionarios"><Funcionarios /></ProtectedRoute>} />
              <Route path="/migrar-dados" element={<MigrarDados />} />
              <Route path="/acesso-negado" element={<AcessoNegado />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
