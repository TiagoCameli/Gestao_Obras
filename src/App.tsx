import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './components/layout/MainLayout';
import FullscreenLayout from './components/layout/FullscreenLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import ObrasPage from './pages/ObrasPage';
import CadastrosHub from './modules/cadastros/CadastrosHub';
import EntityCadastroRoute from './modules/cadastros/EntityCadastroRoute';
import EtapasPage from './modules/cadastros/EtapasPage';
import UnificacaoPage from './modules/cadastros/UnificacaoPage';
import Frete from './pages/Frete';
import Depositos from './pages/Depositos';
import Funcionarios from './pages/Funcionarios';
import Frota from './pages/Frota';
import Manutencao from './pages/Manutencao';
import Combustivel from './pages/Combustivel';
import Login from './pages/Login';
import AcessoNegado from './pages/AcessoNegado';
import NotFound from './pages/NotFound';
import RodoTrackerPage from './modules/rodotracker/RodoTrackerPage';
import ApontamentoPage from './modules/apontamento/ApontamentoPage';
import MobileLayout from './layouts/MobileLayout';
import MMedicaoPage from './pages/mobile/MMedicaoPage';
import MAbrirOSPage from './pages/mobile/MAbrirOSPage';
import MEquipamentoHubPage from './pages/mobile/MEquipamentoHubPage';
import MEquipamentoInfoPage from './pages/mobile/MEquipamentoInfoPage';
import MSaidaCombustivelPage from './pages/mobile/MSaidaCombustivelPage';

const MScanPage = lazy(() => import('./pages/mobile/MScanPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Smoke-fix: dados ficam "fresh" por 5 min em vez de 30s.
      // Isso reduz o splash "Carregando..." quando o usuário volta para uma
      // tela visitada recentemente (cache do React Query reaproveita).
      staleTime: 5 * 60_000,
      // Mantém os dados em memória por 10 min depois de saírem de tela.
      gcTime: 10 * 60_000,
      // Não faz refetch automático ao reabrir a aba — evita splash.
      refetchOnWindowFocus: false,
    },
  },
});

const PAGINAS_FALLBACK: { acao: string; rota: string }[] = [
  { acao: 'ver_obras', rota: '/obras' },
  { acao: 'ver_depositos', rota: '/depositos' },
  { acao: 'ver_cadastros', rota: '/cadastros' },
  { acao: 'ver_frete', rota: '/frete' },
  { acao: 'ver_frota', rota: '/frota' },
  { acao: 'ver_funcionarios', rota: '/funcionarios' },
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
          <ToastProvider>
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
              <Route path="/cadastros" element={<ProtectedRoute modulo="cadastros"><CadastrosHub /></ProtectedRoute>} />
              <Route path="/cadastros/etapas" element={<ProtectedRoute modulo="cadastros"><EtapasPage /></ProtectedRoute>} />
              <Route path="/cadastros/usuarios" element={<ProtectedRoute modulo="funcionarios"><Funcionarios /></ProtectedRoute>} />
              <Route path="/cadastros/unificacao" element={<ProtectedRoute modulo="cadastros"><UnificacaoPage /></ProtectedRoute>} />
              <Route path="/cadastros/:slug" element={<ProtectedRoute modulo="cadastros"><EntityCadastroRoute /></ProtectedRoute>} />
              <Route path="/depositos" element={<ProtectedRoute modulo="depositos"><Depositos /></ProtectedRoute>} />
              <Route path="/frete" element={<ProtectedRoute modulo="frete"><Frete /></ProtectedRoute>} />
              <Route path="/frota" element={<ProtectedRoute modulo="frota"><Frota /></ProtectedRoute>} />
              <Route path="/manutencao" element={<ProtectedRoute modulo="frota"><Manutencao /></ProtectedRoute>} />
              <Route path="/manutencao/dashboard" element={<ProtectedRoute modulo="frota"><Manutencao /></ProtectedRoute>} />
              <Route path="/manutencao/os" element={<ProtectedRoute modulo="frota"><Manutencao /></ProtectedRoute>} />
              <Route path="/manutencao/os/:numero" element={<ProtectedRoute modulo="frota"><Manutencao /></ProtectedRoute>} />
              <Route path="/manutencao/almoxarifado" element={<ProtectedRoute modulo="frota"><Manutencao /></ProtectedRoute>} />
              <Route path="/combustivel" element={<ProtectedRoute modulo="frota"><Combustivel /></ProtectedRoute>} />
              <Route path="/funcionarios" element={<ProtectedRoute modulo="funcionarios"><Funcionarios /></ProtectedRoute>} />
              <Route path="/apontamento" element={<ProtectedRoute modulo="apontamento_rh"><ApontamentoPage /></ProtectedRoute>} />
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

            {/* Rotas mobile (PR25a Marco 5) — layout dedicado sem header desktop */}
            <Route
              element={
                <ProtectedRoute acao="usar_app_mobile">
                  <MobileLayout />
                </ProtectedRoute>
              }
            >
              {/* /m foi descontinuada: hub do equipamento só acessível via scan QR
                  a partir de /frota, /manutencao ou /combustivel. Redirect silencioso. */}
              <Route path="/m" element={<Navigate to="/frota" replace />} />
              <Route
                path="/m/scan"
                element={
                  <ProtectedRoute acao="scan_qr_equipamento">
                    <Suspense fallback={<div className="p-8 text-center text-[var(--color-fg-muted)]">Carregando scanner…</div>}>
                      <MScanPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/m/eq/:equipamentoId" element={<MEquipamentoHubPage />} />
              <Route path="/m/eq/:equipamentoId/info" element={<MEquipamentoInfoPage />} />
              <Route path="/m/medicao/:equipamentoId" element={<ProtectedRoute acao="lancar_medicao_mobile"><MMedicaoPage /></ProtectedRoute>} />
              <Route path="/m/abrir-os/:equipamentoId" element={<ProtectedRoute acao="abrir_os_mobile"><MAbrirOSPage /></ProtectedRoute>} />
              <Route path="/m/saida-combustivel/:equipamentoId" element={<ProtectedRoute acao="saida_combustivel_mobile"><MSaidaCombustivelPage /></ProtectedRoute>} />
            </Route>
          </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
