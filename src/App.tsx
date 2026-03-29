import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Components
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGuard } from './components/RoleGuard';
import { OfflineBanner } from './components/OfflineBanner';

// Pages
import { LoginPage } from './pages/LoginPage';
import { TrocarSenhaPage } from './pages/TrocarSenhaPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

// Admin Pages
import { AdminPage } from './pages/admin/AdminPage';
import { UsuariosPage } from './pages/admin/UsuariosPage';
import { ConfiguracaoDiasPage } from './pages/admin/ConfiguracaoDiasPage';
import { GerenciarFilaPage } from './pages/admin/GerenciarFilaPage';
import { LogsPage } from './pages/admin/LogsPage';

// Module Pages
import { RecepcaoPage } from './pages/RecepcaoPage';
import { AtendimentoPage } from './pages/AtendimentoPage';
import { AgendamentoPage } from './pages/AgendamentoPage';
import { RelatoriosPage } from './pages/RelatoriosPage';

// Hooks
import { useAuth } from './hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Componente que redireciona para o módulo correto após login
 */
function RedirectByPerfil() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin vai para admin, atendente vai para recepção
  if (user.perfil === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/recepcao" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <OfflineBanner />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#22c55e',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/trocar-senha" element={
            <ProtectedRoute>
              <TrocarSenhaPage />
            </ProtectedRoute>
          } />

          {/* Redirect after login */}
          <Route path="/" element={
            <ProtectedRoute>
              <RedirectByPerfil />
            </ProtectedRoute>
          } />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />

          {/* Admin routes - only admin */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <AdminPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin/usuarios" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <UsuariosPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin/calendario" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <ConfiguracaoDiasPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin/fila" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <GerenciarFilaPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin/logs" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <LogsPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin/configuracoes" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin']}>
                <ConfiguracaoDiasPage />
              </RoleGuard>
            </ProtectedRoute>
          } />

          {/* Module routes - admin and atendente */}
          <Route path="/recepcao" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin', 'atendente']}>
                <RecepcaoPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/atendimento" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin', 'atendente']}>
                <AtendimentoPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/agendamento" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin', 'atendente']}>
                <AgendamentoPage />
              </RoleGuard>
            </ProtectedRoute>
          } />
          <Route path="/relatorios" element={
            <ProtectedRoute>
              <RoleGuard allowedPerfis={['admin', 'atendente']}>
                <RelatoriosPage />
              </RoleGuard>
            </ProtectedRoute>
          } />

          {/* Access denied */}
          <Route path="/acesso-negado" element={<AccessDeniedPage />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;