import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ChatConsole from './components/ChatConsole';
import Settings from './components/Settings';
import KnowledgeBase from './components/KnowledgeBase';
import AgentsManagement from './components/AgentsManagement';
import Reports from './components/Reports';
import Login from './components/Login';
import PublicWebChat from './components/PublicWebChat';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';

// Componente para proteger rutas privadas
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { currentUser } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={!currentUser ? <Login /> : <Navigate to="/" />} />
      <Route path="/live-demo" element={<PublicWebChat />} />
      
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/chat" element={<ChatConsole />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/knowledge" element={<KnowledgeBase />} />
              <Route path="/agents" element={<AgentsManagement />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
};

export default App;