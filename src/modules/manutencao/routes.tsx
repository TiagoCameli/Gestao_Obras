import { Navigate, Route } from 'react-router-dom';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import ManutencaoPage from './ManutencaoPage';
import FrotaPage from './pages/FrotaPage';
import EquipamentoNovoPage from './pages/EquipamentoNovoPage';
import EquipamentoDetalhesPage from './pages/EquipamentoDetalhesPage';
import EquipamentoEditarPage from './pages/EquipamentoEditarPage';
import ExecutarManutencaoPage from './pages/ExecutarManutencaoPage';
import EditarRegistroPage from './pages/EditarRegistroPage';
import ModelosPage from './pages/ModelosPage';
import ModeloNovoPage from './pages/ModeloNovoPage';
import ModeloDetalhesPage from './pages/ModeloDetalhesPage';
import ModeloEditarPage from './pages/ModeloEditarPage';
import TarefaNovaPage from './pages/TarefaNovaPage';
import TarefaDetalhesPage from './pages/TarefaDetalhesPage';
import TarefaEditarPage from './pages/TarefaEditarPage';
import AlertasPage from './pages/AlertasPage';

export const manutencaoRoutes = (
  <Route
    path="/manutencao"
    element={
      <ProtectedRoute modulo="manutencao">
        <ManutencaoPage />
      </ProtectedRoute>
    }
  >
    <Route index element={<Navigate to="frota" replace />} />
    <Route path="frota" element={<FrotaPage />} />
    <Route path="frota/novo" element={<EquipamentoNovoPage />} />
    <Route path="frota/:id" element={<EquipamentoDetalhesPage />} />
    <Route path="frota/:id/editar" element={<EquipamentoEditarPage />} />
    <Route
      path="frota/:equipamentoId/registrar/:tarefaId"
      element={<ExecutarManutencaoPage />}
    />
    <Route path="registros/:registroId/editar" element={<EditarRegistroPage />} />
    <Route path="modelos" element={<ModelosPage />} />
    <Route path="modelos/novo" element={<ModeloNovoPage />} />
    <Route path="modelos/:id" element={<ModeloDetalhesPage />} />
    <Route path="modelos/:id/editar" element={<ModeloEditarPage />} />
    <Route path="modelos/:id/tarefas/novo" element={<TarefaNovaPage />} />
    <Route path="modelos/:id/tarefas/:tarefaId" element={<TarefaDetalhesPage />} />
    <Route path="modelos/:id/tarefas/:tarefaId/editar" element={<TarefaEditarPage />} />
    <Route path="alertas" element={<AlertasPage />} />
  </Route>
);

export default manutencaoRoutes;
