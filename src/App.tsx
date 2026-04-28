import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MainLayout from './components/layout/MainLayout';
import FullscreenLayout from './components/layout/FullscreenLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import ObrasPage from './pages/ObrasPage';
import Obras from './pages/Obras';
import Frete from './pages/Frete';
import SaldoTransportadora from './pages/SaldoTransportadora';
import Funcionarios from './pages/Funcionarios';
import Apontamentos from './pages/Apontamentos';
import Frota from './pages/Frota';
import Login from './pages/Login';
import AcessoNegado from './pages/AcessoNegado';
import NotFound from './pages/NotFound';
import MigrarDados from './pages/MigrarDados';
import RodoTrackerPage from './modules/rodotracker/RodoTrackerPage';
import ApontamentoPage from './modules/apontamento/ApontamentoPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

const PAGINAS_FALLBACK: { acao: string; rota: string }[] = [
  { acao: 'ver_obras', rota: '/obras' },
  { acao: 'ver_cadastros', rota: '/cadastros' },
  { acao: 'ver_frete', rota: '/frete' },
  { acao: 'ver_frota', rota: '/frota' },
  { acao: 'ver_funcionarios', rota: '/funcionarios' },
  { acao: 'ver_apontamentos', rota: '/apontamentos' },
  { acao: 'ver_apontamento_rh', rota: '/apontamento' },
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
    <ThemeProvider>
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
              <Route path="/obras" element={<ProtectedRoute modulo="obras"><ObrasPage /></ProtectedRoute>} />
              <Route path="/cadastros" element={<ProtectedRoute modulo="cadastros"><Obras /></ProtectedRoute>} />
              <Route path="/frete" element={<ProtectedRoute modulo="frete"><Frete /></ProtectedRoute>} />
              <Route path="/frete/saldo/:slug" element={<ProtectedRoute modulo="frete"><SaldoTransportadora /></ProtectedRoute>} />
              <Route path="/frota" element={<ProtectedRoute modulo="frota"><Frota /></ProtectedRoute>} />
              <Route path="/funcionarios" element={<ProtectedRoute modulo="funcionarios"><Funcionarios /></ProtectedRoute>} />
              <Route path="/apontamentos" element={<ProtectedRoute modulo="apontamentos"><Apontamentos /></ProtectedRoute>} />
              <Route path="/apontamento" element={<ProtectedRoute modulo="apontamento_rh"><ApontamentoPage /></ProtectedRoute>} />
              <Route path="/migrar-dados" element={<MigrarDados />} />
              <Route path="/acesso-negado" element={<AcessoNegado />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route
              element={
                <ProtectedRoute>
                  <FullscreenLayout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/medicao/*"
                element={
                  <ProtectedRoute modulo="medicao">
                    <RodoTrackerPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
