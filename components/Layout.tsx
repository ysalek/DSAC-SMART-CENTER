import React from 'react';
import { LayoutDashboard, MessageSquare, Users, BookOpen, Settings, Phone, LogOut, Circle, Globe, FileBarChart } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../src/contexts/AuthContext';
import { toggleAgentStatus } from '../services/agentsService';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { agentProfile, currentUser, logout } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: 'Atención', path: '/chat', icon: <MessageSquare size={20} /> },
    { name: 'Reportes', path: '/reports', icon: <FileBarChart size={20} /> },
    { name: 'Agentes', path: '/agents', icon: <Users size={20} /> },
    { name: 'Base Conocimiento', path: '/knowledge', icon: <BookOpen size={20} /> },
    { name: 'Configuración', path: '/settings', icon: <Settings size={20} /> },
  ];

  // Obtener iniciales
  const displayName = agentProfile?.displayName || currentUser?.email?.split('@')[0] || 'Operador';
  const role = agentProfile?.role || 'Agente';
  const isOnline = agentProfile?.online || false;

  const handleToggleStatus = async () => {
    if (agentProfile) {
      await toggleAgentStatus(agentProfile.id, isOnline);
      // El contexto se actualizará automáticamente vía Firestore listener si se implementara,
      // pero por ahora dependemos de la recarga o del estado local optimista en componentes.
      // En una app real, AuthContext debería escuchar cambios en el documento del agente.
      window.location.reload(); // Simple reload to refresh context for MVP
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-green-900 text-white flex flex-col shadow-lg transition-all">
        <div className="p-6 border-b border-green-800 flex items-center gap-3">
          <div className="bg-white p-2 rounded-full text-green-900 shadow-sm">
            <Phone size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">DSAC</h1>
            <p className="text-xs text-green-300">Santa Cruz Smart</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-green-700 text-white shadow-md border-l-4 border-white'
                  : 'text-green-100 hover:bg-green-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}

          {/* Enlace al simulador (Solo para demo) */}
          <div className="pt-4 mt-4 border-t border-green-800">
             <Link 
               to="/live-demo" 
               target="_blank"
               className="flex items-center gap-3 px-4 py-3 rounded-lg text-green-200 hover:bg-green-800 hover:text-white transition-colors"
             >
                <Globe size={20} />
                <div className="flex flex-col">
                   <span className="font-medium">Simulador Web</span>
                   <span className="text-[10px] opacity-70">Abrir widget de ciudadano</span>
                </div>
             </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-green-800 bg-green-900">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold border-2 border-green-400 relative">
              {displayName.charAt(0).toUpperCase()}
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-green-900 ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`}></div>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold truncate">{displayName}</p>
              <button 
                onClick={handleToggleStatus}
                className="text-xs text-green-300 flex items-center gap-1 hover:text-white transition"
              >
                <Circle size={8} fill={isOnline ? "currentColor" : "none"} />
                {isOnline ? 'En Línea' : 'Ausente'}
              </button>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 text-xs py-2 rounded text-green-100 transition"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
};

export default Layout;