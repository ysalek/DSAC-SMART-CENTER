import React, { useEffect, useState } from 'react';
import { UserPlus, User, Power, Trash2, Mail, Shield } from 'lucide-react';
import { getAgents, addAgent, toggleAgentStatus, deleteAgent } from '../services/agentsService';
import { Agent } from '../types';
import { useAuth } from '../src/contexts/AuthContext';

const AgentsManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newAgent, setNewAgent] = useState({
    displayName: '',
    email: '',
    role: 'AGENT' as 'AGENT' | 'SUPERVISOR' | 'ADMIN',
    online: false
  });

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await getAgents();
      setAgents(data);
    } catch (error) {
      console.error("Error loading agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAgent(newAgent);
      setShowForm(false);
      setNewAgent({ displayName: '', email: '', role: 'AGENT', online: false });
      loadAgents();
    } catch (error) {
      alert("Error creando agente");
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    try {
      await toggleAgentStatus(agent.id, agent.online);
      // Optimistic update
      setAgents(agents.map(a => a.id === agent.id ? { ...a, online: !a.online } : a));
    } catch (error) {
      console.error(error);
      loadAgents(); // Revert on error
    }
  };

  const handleDelete = async (id: string) => {
    if (currentUser && id === currentUser.uid) {
      alert("No puedes eliminar tu propia cuenta mientras estás conectado.");
      return;
    }

    if (window.confirm('¿Estás seguro de que deseas eliminar este agente del sistema permanentemente?')) {
      try {
        await deleteAgent(id);
        // Actualización optimista para feedback inmediato
        setAgents(prev => prev.filter(a => a.id !== id));
      } catch (error) {
        console.error("Error al eliminar:", error);
        alert("Ocurrió un error al intentar eliminar el agente. Verifica tu conexión o permisos.");
        loadAgents(); // Recargar por si acaso
      }
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Agentes</h1>
          <p className="text-gray-500 text-sm">Administra el personal del centro de contacto.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <UserPlus size={18} /> {showForm ? 'Cancelar' : 'Nuevo Agente'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-blue-100 mb-8 max-w-2xl">
          <h3 className="font-bold text-gray-800 mb-4">Registrar Nuevo Operador</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newAgent.displayName}
                onChange={e => setNewAgent({...newAgent, displayName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newAgent.email}
                onChange={e => setNewAgent({...newAgent, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol</label>
              <select 
                className="w-full border border-gray-300 rounded px-3 py-2"
                value={newAgent.role}
                onChange={e => setNewAgent({...newAgent, role: e.target.value as any})}
              >
                <option value="AGENT">Agente</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end mt-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                Guardar Agente
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando personal...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Agente</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Conectado Desde</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map(agent => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{agent.displayName}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail size={10} /> {agent.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Shield size={14} className="text-blue-500" />
                      {agent.role}
                    </div>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleToggleStatus(agent)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        agent.online 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agent.online ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                      {agent.online ? 'En Línea' : 'Desconectado'}
                    </button>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {agent.updatedAt?.toDate ? agent.updatedAt.toDate().toLocaleString() : 'Nunca'}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleDelete(agent.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                      title="Eliminar agente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No hay agentes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AgentsManagement;